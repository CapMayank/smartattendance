import { describe, expect, it } from "vitest"
import { generatePayslipPdf } from "./payslip-pdf"
import { PDFDocument } from "pdf-lib"
import * as zlib from "zlib"

function extractPdfText(pdfBytes: Uint8Array): string {
  const buf = Buffer.from(pdfBytes)
  let text = ""
  let idx = 0
  while ((idx = buf.indexOf("stream", idx)) !== -1) {
    let start = idx + 6
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2
    else if (buf[start] === 0x0a || buf[start] === 0x0d) start += 1
    const end = buf.indexOf("endstream", start)
    if (end !== -1) {
      const streamData = buf.subarray(start, end)
      let streamStr = ""
      try {
        const decompressed = zlib.inflateSync(streamData)
        streamStr = decompressed.toString("latin1")
      } catch {
        streamStr = streamData.toString("latin1")
      }
      const decoded = streamStr.replace(/<([0-9a-fA-F]+)>/g, (_, hex) => {
        try {
          return Buffer.from(hex, "hex").toString("utf-8")
        } catch {
          return ""
        }
      })
      text += decoded + "\n"
      idx = end + 9
    } else {
      break
    }
  }
  return text
}

const mockPayrollBankEpf = {
  id: "payroll-1",
  staffId: "staff-1",
  payGroup: "BANK_EPF",
  month: 3,
  year: 2026,
  totalDays: 31,
  presentDays: 26,
  ncpDays: 5,
  actualCtc: 25000,
  grossWage: 21000,
  basicWage: 18000,
  bonusAmount: 3000,
  bonusDays: 2,
  bonusType: "CUSTOM",
  isBonusPfApplicable: false,
  epfWages: 18000,
  epsWages: 15000,
  edliWages: 15000,
  employeeEpf: 1800,
  employerEps: 1250,
  employerEpf: 550,
  refundOfAdvance: 500,
  netPayment: 18700,
  isLocked: true,
  createdAt: new Date("2026-03-31"),
  updatedAt: new Date("2026-03-31"),
  staff: {
    id: "staff-1",
    machineId: "101",
    name: "Aman Sharma",
    employeeCode: "SEHSS-042",
    joiningDate: "2024-06-15",
    departmentId: "dept-1",
    designationId: "desig-1",
    shiftId: null,
    profilePhotoId: null,
    profilePhotoPinned: false,
    createdAt: new Date("2024-06-15"),
    updatedAt: new Date("2026-03-31"),
    department: {
      id: "dept-1",
      name: "Mathematics",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
    designation: {
      id: "desig-1",
      name: "Senior Teacher",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
    payrollInfo: {
      id: "pinfo-1",
      staffId: "staff-1",
      payGroup: "BANK_EPF",
      isActiveForPayroll: true,
      monthlyCtc: 25000,
      bankAccount: "123456789012",
      ifsc: "SBIN0001234",
      nameAsPerBank: "Aman Sharma",
      uan: "101234567890",
      nameOnUan: "Aman Sharma",
      pan: "ABCDE1234F",
      aadhaar: "123412341234",
      previousMemberId: null,
      dob: null,
      doj: new Date("2024-06-15"),
      gender: null,
      fatherHusbandName: null,
      relationship: null,
      mobileNumber: null,
      email: null,
      nationality: "INDIAN",
      qualification: null,
      maritalStatus: null,
      isInternationalWorker: "N",
      countryOfOrigin: "INDIA",
      passportNumber: null,
      passportValidFrom: null,
      passportValidTill: null,
    },
  },
}

const mockPayrollCash = {
  ...mockPayrollBankEpf,
  id: "payroll-2",
  staffId: "staff-2",
  payGroup: "CASH",
  staff: {
    ...mockPayrollBankEpf.staff,
    id: "staff-2",
    name: "Sunita Verma",
    employeeCode: "SEHSS-088",
    department: null,
    designation: null,
    payrollInfo: {
      ...mockPayrollBankEpf.staff.payrollInfo,
      id: "pinfo-2",
      staffId: "staff-2",
      payGroup: "CASH",
      bankAccount: null,
      ifsc: null,
      uan: null,
      pan: null,
    },
  },
}

describe("generatePayslipPdf", () => {
  it("generates a valid A4 PDF starting with %PDF- header", async () => {
    const pdfBytes = await generatePayslipPdf(mockPayrollBankEpf as any)

    expect(pdfBytes).toBeInstanceOf(Uint8Array)
    expect(pdfBytes.length).toBeGreaterThan(1000)

    // Check %PDF- magic bytes
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8")
    expect(header).toBe("%PDF-")

    // Check valid PDF structure and single A4 page
    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBe(1)
    const page = doc.getPage(0)
    const { width, height } = page.getSize()
    expect(Math.round(width)).toBe(595) // 595.28 pt A4 width
    expect(Math.round(height)).toBe(842) // 841.89 pt A4 height
  })

  it("successfully renders bank & EPF details without crashing", async () => {
    const pdfBytes = await generatePayslipPdf(mockPayrollBankEpf as any)
    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it("handles cash payment group with null bank and tax details", async () => {
    const pdfBytes = await generatePayslipPdf(mockPayrollCash as any)
    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it("handles staff with null department, designation, and payrollInfo", async () => {
    const minimalPayroll = {
      ...mockPayrollBankEpf,
      staff: {
        ...mockPayrollBankEpf.staff,
        department: null,
        designation: null,
        payrollInfo: null,
      },
    }
    const pdfBytes = await generatePayslipPdf(minimalPayroll as any)
    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it("does not include internal fields like Machine ID and Pay Group", async () => {
    const pdfBytes = await generatePayslipPdf(mockPayrollBankEpf as any)
    const text = extractPdfText(pdfBytes)
    expect(text).toContain("Employee Name:")
    expect(text).toContain("Employee Code:")
    expect(text).not.toContain("Machine ID:")
    expect(text).not.toContain("Pay Group:")
  })

  it("omits bonus details when bonusDays and bonusAmount are 0", async () => {
    const zeroBonusPayroll = {
      ...mockPayrollBankEpf,
      bonusDays: 0,
      bonusAmount: 0,
    }
    const pdfBytes = await generatePayslipPdf(zeroBonusPayroll as any)
    const text = extractPdfText(pdfBytes)
    expect(text).not.toContain("Bonus Days")
    expect(text).not.toContain("Bonus / Allowances")
  })

  it("includes bonus details when bonus is given (> 0)", async () => {
    const bonusPayroll = {
      ...mockPayrollBankEpf,
      bonusDays: 3,
      bonusAmount: 5000,
    }
    const pdfBytes = await generatePayslipPdf(bonusPayroll as any)
    const text = extractPdfText(pdfBytes)
    expect(text).toContain("Bonus Days")
    expect(text).toContain("Bonus / Allowances")
  })
})
