import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib"
import type { Prisma } from "@prisma/client"
import { amountInWords } from "./amount-in-words"

export type MonthlyPayrollWithDetails = Prisma.MonthlyPayrollGetPayload<{
  include: {
    staff: {
      include: {
        department: true
        designation: true
        payrollInfo: true
      }
    }
  }
}>

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
]

/**
 * Strips non-WinAnsi unicode characters and converts common unicode glyphs
 * to standard ASCII to prevent PDF-lib WinAnsi encoding crashes.
 */
function cleanAscii(str: string | null | undefined): string {
  if (!str) return ""
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/₹/g, "Rs. ")
    .replace(/[^\x20-\x7E]/g, " ")
    .trim()
}

/**
 * Formats a currency number in Indian numbering format with "Rs. " prefix.
 */
function formatMoney(amount: number): string {
  const isNegative = amount < 0
  const abs = Math.abs(amount)
  const parts = abs.toFixed(2).split(".")
  const intPart = parts[0]
  const decPart = parts[1]

  let lastThree = intPart.substring(intPart.length - 3)
  const otherNumbers = intPart.substring(0, intPart.length - 3)
  if (otherNumbers !== "") {
    lastThree = "," + lastThree
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree
  const prefix = isNegative ? "-Rs. " : "Rs. "
  return `${prefix}${formattedInt}.${decPart}`
}

/**
 * Generates a publication-grade vector A4 PDF salary slip for a staff member.
 */
export async function generatePayslipPdf(payroll: MonthlyPayrollWithDetails): Promise<Uint8Array> {
  const doc = await PDFDocument.create()

  // Standard A4 portrait: 595.28 x 841.89 points
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 36 // 0.5 inch margins
  const contentWidth = pageWidth - margin * 2 // 523.28 pt

  const page = doc.addPage([pageWidth, pageHeight])

  // Embed standard typography
  const regularFont = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique)

  // Color Palette
  const navy = rgb(0.08, 0.2, 0.45) // School crest navy
  const darkSlate = rgb(0.12, 0.15, 0.2) // Primary text
  const mutedSlate = rgb(0.4, 0.45, 0.52) // Secondary text
  const lightGrayBg = rgb(0.95, 0.96, 0.98) // Card & header backgrounds
  const tableBorder = rgb(0.82, 0.85, 0.89) // Structural borders
  const white = rgb(1, 1, 1)

  // Helper for right-aligned text
  const drawTextRight = (
    text: string,
    rightX: number,
    y: number,
    font: PDFFont,
    size: number,
    color = darkSlate
  ) => {
    const textWidth = font.widthOfTextAtSize(text, size)
    page.drawText(text, {
      x: rightX - textWidth,
      y,
      size,
      font,
      color,
    })
  }

  // Helper for centered text
  const drawTextCenter = (
    text: string,
    centerX: number,
    y: number,
    font: PDFFont,
    size: number,
    color = darkSlate
  ) => {
    const textWidth = font.widthOfTextAtSize(text, size)
    page.drawText(text, {
      x: centerX - textWidth / 2,
      y,
      size,
      font,
      color,
    })
  }

  let curY = pageHeight - margin // Starts at 805.89 pt

  // ==========================================
  // 1. INSTITUTIONAL HEADER & LETTERHEAD
  // ==========================================
  const schoolName = "SARVODAYA ENGLISH HIGHER SECONDARY SCHOOL"
  const schoolSub = "Lakhnadon, Dist. Seoni (M.P.)"
  const monthName = MONTH_NAMES[(payroll.month - 1) % 12] || "MONTH"
  const title = `PAYSLIP FOR ${monthName} ${payroll.year}`

  // School Name
  drawTextCenter(schoolName, pageWidth / 2, curY - 14, boldFont, 15, navy)
  curY -= 20

  // Subtitle
  drawTextCenter(schoolSub, pageWidth / 2, curY - 10, regularFont, 9.5, mutedSlate)
  curY -= 20

  // Title Box Banner
  const titleBoxH = 24
  page.drawRectangle({
    x: margin,
    y: curY - titleBoxH,
    width: contentWidth,
    height: titleBoxH,
    color: lightGrayBg,
    borderColor: tableBorder,
    borderWidth: 1,
  })
  drawTextCenter(title, pageWidth / 2, curY - 16, boldFont, 11, navy)
  curY -= titleBoxH + 12

  // ==========================================
  // 2. STAFF INFORMATION BLOCK
  // ==========================================
  const staff = payroll.staff
  const pInfo = staff.payrollInfo

  const joiningDateStr =
    staff.joiningDate ||
    (pInfo?.doj ? new Date(pInfo.doj).toISOString().slice(0, 10) : "-")

  const payGroupDisplay = payroll.payGroup === "BANK_EPF" ? "Bank / EPF" : "Cash"
  const bankDisplay =
    payroll.payGroup === "BANK_EPF"
      ? `${pInfo?.bankAccount || "-"} (${pInfo?.ifsc || "-"})`
      : "Cash Payment"

  const staffDetails: [string, string, string, string][] = [
    [
      "Employee Name:",
      cleanAscii(staff.name),
      "Employee Code:",
      cleanAscii(staff.employeeCode) || "-",
    ],
    [
      "Designation:",
      cleanAscii(staff.designation?.name) || "-",
      "Department:",
      cleanAscii(staff.department?.name) || "-",
    ],
    [
      "Machine ID:",
      cleanAscii(staff.machineId),
      "Date of Joining:",
      cleanAscii(joiningDateStr),
    ],
    [
      "Pay Group:",
      payGroupDisplay,
      "Bank A/C & IFSC:",
      cleanAscii(bankDisplay),
    ],
    [
      "UAN Number:",
      cleanAscii(pInfo?.uan) || "-",
      "PAN Number:",
      cleanAscii(pInfo?.pan) || "-",
    ],
  ]

  const infoRowH = 17
  const infoTableH = staffDetails.length * infoRowH + 6
  page.drawRectangle({
    x: margin,
    y: curY - infoTableH,
    width: contentWidth,
    height: infoTableH,
    borderColor: tableBorder,
    borderWidth: 1,
    color: white,
  })

  let infoY = curY - 15
  const col1LabelX = margin + 10
  const col1ValX = margin + 100
  const col2LabelX = margin + 265
  const col2ValX = margin + 370

  for (const [l1, v1, l2, v2] of staffDetails) {
    page.drawText(l1, { x: col1LabelX, y: infoY, size: 8.5, font: boldFont, color: darkSlate })
    page.drawText(v1, { x: col1ValX, y: infoY, size: 8.5, font: regularFont, color: darkSlate })
    page.drawText(l2, { x: col2LabelX, y: infoY, size: 8.5, font: boldFont, color: darkSlate })
    page.drawText(v2, { x: col2ValX, y: infoY, size: 8.5, font: regularFont, color: darkSlate })
    infoY -= infoRowH
  }

  curY -= infoTableH + 12

  // ==========================================
  // 3. ATTENDANCE STRIP
  // ==========================================
  const attMetrics = [
    { label: "Days in Month", value: String(payroll.totalDays) },
    { label: "Paid / Present Days", value: String(payroll.presentDays) },
    { label: "LOP / NCP Days", value: String(payroll.ncpDays) },
    { label: "Bonus Days", value: String(payroll.bonusDays ?? 0) },
  ]

  const attStripH = 34
  page.drawRectangle({
    x: margin,
    y: curY - attStripH,
    width: contentWidth,
    height: attStripH,
    color: lightGrayBg,
    borderColor: tableBorder,
    borderWidth: 1,
  })

  const attColW = contentWidth / 4
  attMetrics.forEach((m, idx) => {
    const colCenterX = margin + idx * attColW + attColW / 2
    drawTextCenter(m.label, colCenterX, curY - 13, regularFont, 8, mutedSlate)
    drawTextCenter(m.value, colCenterX, curY - 26, boldFont, 10, navy)

    if (idx > 0) {
      // vertical divider between columns
      const divX = margin + idx * attColW
      page.drawLine({
        start: { x: divX, y: curY },
        end: { x: divX, y: curY - attStripH },
        color: tableBorder,
        thickness: 1,
      })
    }
  })

  curY -= attStripH + 12

  // ==========================================
  // 4. EARNINGS & DEDUCTIONS TWO-COLUMN TABLE
  // ==========================================
  const colHalfW = contentWidth / 2
  const leftX = margin
  const rightX = margin + colHalfW

  const earningsRows = [
    { label: "Basic Wage", amount: formatMoney(payroll.basicWage) },
    { label: "Bonus / Allowances", amount: formatMoney(payroll.bonusAmount) },
  ]

  const totalDeductions = payroll.employeeEpf + payroll.refundOfAdvance
  const deductionsRows = [
    { label: "Employee EPF (12%)", amount: formatMoney(payroll.employeeEpf) },
    { label: "Advance Recovery", amount: formatMoney(payroll.refundOfAdvance) },
  ]

  const maxRows = Math.max(earningsRows.length, deductionsRows.length)
  const tblHeaderH = 22
  const tblRowH = 19
  const tblTotalH = 22
  const totalTableH = tblHeaderH + maxRows * tblRowH + tblTotalH

  // Outer border & center divider
  page.drawRectangle({
    x: margin,
    y: curY - totalTableH,
    width: contentWidth,
    height: totalTableH,
    borderColor: tableBorder,
    borderWidth: 1,
    color: white,
  })

  // Header background
  page.drawRectangle({
    x: margin,
    y: curY - tblHeaderH,
    width: contentWidth,
    height: tblHeaderH,
    color: lightGrayBg,
    borderColor: tableBorder,
    borderWidth: 1,
  })

  // Middle vertical line through entire table
  page.drawLine({
    start: { x: rightX, y: curY },
    end: { x: rightX, y: curY - totalTableH },
    color: tableBorder,
    thickness: 1,
  })

  // Table Headers
  page.drawText("EARNINGS", { x: leftX + 10, y: curY - 15, size: 9, font: boldFont, color: navy })
  drawTextRight("AMOUNT", rightX - 10, curY - 15, boldFont, 9, navy)

  page.drawText("DEDUCTIONS", { x: rightX + 10, y: curY - 15, size: 9, font: boldFont, color: navy })
  drawTextRight("AMOUNT", margin + contentWidth - 10, curY - 15, boldFont, 9, navy)

  // Item rows
  let rowY = curY - tblHeaderH - 14
  for (let i = 0; i < maxRows; i++) {
    const e = earningsRows[i]
    if (e) {
      page.drawText(e.label, { x: leftX + 10, y: rowY, size: 8.5, font: regularFont, color: darkSlate })
      drawTextRight(e.amount, rightX - 10, rowY, regularFont, 8.5, darkSlate)
    }

    const d = deductionsRows[i]
    if (d) {
      page.drawText(d.label, { x: rightX + 10, y: rowY, size: 8.5, font: regularFont, color: darkSlate })
      drawTextRight(d.amount, margin + contentWidth - 10, rowY, regularFont, 8.5, darkSlate)
    }

    // Horizontal line under row
    page.drawLine({
      start: { x: margin, y: rowY - 5 },
      end: { x: margin + contentWidth, y: rowY - 5 },
      color: tableBorder,
      thickness: 0.5,
    })

    rowY -= tblRowH
  }

  // Totals Row
  const totalRowY = curY - totalTableH + 6
  // Highlight totals background
  page.drawRectangle({
    x: margin + 0.5,
    y: curY - totalTableH + 0.5,
    width: contentWidth - 1,
    height: tblTotalH - 0.5,
    color: lightGrayBg,
  })
  page.drawLine({
    start: { x: margin, y: curY - totalTableH + tblTotalH },
    end: { x: margin + contentWidth, y: curY - totalTableH + tblTotalH },
    color: tableBorder,
    thickness: 1,
  })

  page.drawText("Gross Earnings", {
    x: leftX + 10,
    y: totalRowY + 1,
    size: 9,
    font: boldFont,
    color: darkSlate,
  })
  drawTextRight(formatMoney(payroll.grossWage), rightX - 10, totalRowY + 1, boldFont, 9, darkSlate)

  page.drawText("Total Deductions", {
    x: rightX + 10,
    y: totalRowY + 1,
    size: 9,
    font: boldFont,
    color: darkSlate,
  })
  drawTextRight(formatMoney(totalDeductions), margin + contentWidth - 10, totalRowY + 1, boldFont, 9, darkSlate)

  curY -= totalTableH + 12

  // ==========================================
  // 5. NET PAYABLE BANNER BOX
  // ==========================================
  const netBoxH = 50
  const netFill = rgb(0.94, 0.97, 0.95) // Soft green tint
  const netBorder = rgb(0.18, 0.55, 0.34) // Deep emerald accent

  page.drawRectangle({
    x: margin,
    y: curY - netBoxH,
    width: contentWidth,
    height: netBoxH,
    color: netFill,
    borderColor: netBorder,
    borderWidth: 1.25,
  })

  // Left title & amount in words
  page.drawText("NET PAYABLE AMOUNT", {
    x: margin + 12,
    y: curY - 17,
    size: 9,
    font: boldFont,
    color: navy,
  })

  const words = cleanAscii(amountInWords(payroll.netPayment))
  page.drawText(words, {
    x: margin + 12,
    y: curY - 35,
    size: 8.5,
    font: italicFont,
    color: darkSlate,
  })

  // Right prominent net amount
  const netAmountStr = formatMoney(payroll.netPayment)
  drawTextRight(netAmountStr, margin + contentWidth - 12, curY - 26, boldFont, 14, netBorder)

  curY -= netBoxH + 12

  // ==========================================
  // 6. EMPLOYER CONTRIBUTIONS (INFORMATION ONLY)
  // ==========================================
  const ctcBoxH = 34
  page.drawRectangle({
    x: margin,
    y: curY - ctcBoxH,
    width: contentWidth,
    height: ctcBoxH,
    borderColor: tableBorder,
    borderWidth: 1,
    color: white,
  })

  page.drawText("Employer Contributions (Information Only):", {
    x: margin + 10,
    y: curY - 13,
    size: 8,
    font: boldFont,
    color: mutedSlate,
  })

  const contribCols = [
    `Employer EPF: ${formatMoney(payroll.employerEpf)}`,
    `Employer EPS: ${formatMoney(payroll.employerEps)}`,
    `Total CTC: ${formatMoney(payroll.actualCtc)}`,
  ]

  let contribX = margin + 10
  for (const c of contribCols) {
    page.drawText(c, {
      x: contribX,
      y: curY - 26,
      size: 8.5,
      font: regularFont,
      color: darkSlate,
    })
    contribX += 175
  }

  curY -= ctcBoxH + 30

  // ==========================================
  // 7. SIGNATURES & AUTHORIZATION BLOCK
  // ==========================================
  const sigLineY = 90
  const sigLabelY = 76
  const sigColW = 120

  const sigs = [
    { label: "Prepared By", x: margin + 20 },
    { label: "Verified By", x: margin + contentWidth / 2 - sigColW / 2 },
    { label: "Authorized Signatory (Principal)", x: margin + contentWidth - sigColW - 20 },
  ]

  for (const sig of sigs) {
    page.drawLine({
      start: { x: sig.x, y: sigLineY },
      end: { x: sig.x + sigColW, y: sigLineY },
      color: tableBorder,
      thickness: 1,
    })
    drawTextCenter(sig.label, sig.x + sigColW / 2, sigLabelY, regularFont, 8.5, darkSlate)
  }

  // Footer notice
  const footerNotice =
    "This is a computer-generated salary slip and does not require a physical signature when verified digitally."
  drawTextCenter(footerNotice, pageWidth / 2, 42, regularFont, 7.5, mutedSlate)

  return await doc.save()
}
