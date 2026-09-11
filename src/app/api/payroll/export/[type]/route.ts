import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { format } from "date-fns";

function numberToIndianWords(num: number): string {
  if (num === 0) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const numToWords = (n: number, suffix: string): string => {
    let str = "";
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 > 0 ? " " + a[n % 10] : "");
    } else {
      str += a[n];
    }
    if (n > 0) str += " " + suffix + " ";
    return str;
  };

  let res = "";
  res += numToWords(Math.floor(num / 10000000), "Crore");
  res += numToWords(Math.floor((num / 100000) % 100), "Lakh");
  res += numToWords(Math.floor((num / 1000) % 100), "Thousand");
  res += numToWords(Math.floor((num / 100) % 10), "Hundred");
  if (num > 100 && num % 100 > 0) res += " ";
  res += numToWords(num % 100, "");

  return res.trim();
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "");
    const year = parseInt(searchParams.get("year") || "");

    if (!type) {
      return new NextResponse("Export type is required", { status: 400 });
    }

    if (isNaN(month) || isNaN(year)) {
      return new NextResponse("Invalid month or year", { status: 400 });
    }

    const payrolls = await prisma.monthlyPayroll.findMany({
      where: { month, year },
      include: {
        staff: {
          include: {
            payrollInfo: true
          }
        }
      },
    });

    // Sort numerically by machineId
    payrolls.sort((a, b) => a.staff.machineId.localeCompare(b.staff.machineId, undefined, { numeric: true }));

    if (payrolls.length === 0) {
      return new NextResponse("No payroll records found for this month", { status: 404 });
    }

    const monthDate = new Date(year, month - 1, 1);
    const monthLabel = format(monthDate, "MMMM_yyyy");
    const lastDay = new Date(year, month, 0).getDate();

    if (type === "bank-payment") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Bank Payment");

      sheet.columns = [
        { width: 10 }, // S.No
        { width: 40 }, // Employee Name
        { width: 30 }, // Bank Account
        { width: 20 }  // Payment Amount
      ];

      // Setup page for perfect printing on A4 portrait
      sheet.pageSetup = {
        paperSize: 9, // A4
        orientation: 'portrait',
        margins: {
          left: 0.7, right: 0.7,
          top: 0.75, bottom: 0.75,
          header: 0.3, footer: 0.3
        },
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0 // Scale height automatically
      };

      // Merge and set titles
      sheet.mergeCells('A1:D1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = "Sarvodaya English Higher Secondary School Lakhandon";
      titleCell.font = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.mergeCells('A2:D2');
      const subtitleCell = sheet.getCell('A2');
      subtitleCell.value = `Bank Payment Statement for ${format(monthDate, "MMMM yyyy")} (1st to ${lastDay}th)`;
      subtitleCell.font = { bold: true, size: 11 };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.getRow(1).height = 22;
      sheet.getRow(2).height = 22;

      // Header row
      const hdrRow = sheet.getRow(4);
      hdrRow.values = ["S.No", "Employee Name", "Bank Account", "Payment Amount"];
      hdrRow.height = 22;
      
      hdrRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      let o = 5;
      let total = 0;
      let sno = 1;

      for (const p of payrolls) {
        if (p.netPayment > 0) {
          const row = sheet.getRow(o);
          row.values = [
            sno,
            p.staff.payrollInfo?.nameAsPerBank || p.staff.name,
            p.staff.payrollInfo?.bankAccount || "",
            p.netPayment
          ];
          row.getCell(1).alignment = { horizontal: 'center' };
          row.getCell(3).numFmt = '@';
          row.getCell(4).numFmt = '#,##0';
          
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });

          total += p.netPayment;
          o++;
          sno++;
        }
      }

      const totRow = sheet.getRow(o);
      totRow.getCell(3).value = "TOTAL PAYMENT:";
      totRow.getCell(4).value = total;
      totRow.getCell(4).numFmt = '#,##0';
      totRow.getCell(3).font = { bold: true };
      totRow.getCell(4).font = { bold: true };
      totRow.getCell(3).border = { top: { style: 'medium' } };
      totRow.getCell(4).border = { top: { style: 'medium' } };

      const wordsRow = sheet.getRow(o + 2);
      sheet.mergeCells(`A${o + 2}:D${o + 2}`);
      const wordsCell = wordsRow.getCell(1);
      wordsCell.value = `Amount in Words: ${numberToIndianWords(total)} Rupees Only`;
      wordsCell.font = { italic: true };
      wordsCell.alignment = { horizontal: 'left', vertical: 'middle' };

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Disposition": `attachment; filename="Bank_Payment_${monthLabel.toUpperCase()}.xlsx"`,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });

    } else if (type === "ecr-final") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("ECR Format");

      sheet.columns = [
        { width: 20 }, // UAN
        { width: 40 }, // Name
        { width: 18 }, // Gross
        { width: 15 }, // EPF
        { width: 15 }, // EPS
        { width: 15 }, // EDLI
        { width: 20 }, // Emp PF
        { width: 22 }, // ER EPS
        { width: 22 }, // ER EPF
        { width: 15 }, // NCP
        { width: 22 }  // Refund
      ];

      const headers = [
        "UAN", "Member Name", "Gross Wages", "EPF Wages", "EPS Wages", "EDLI Wages",
        "Employee PF (12%)", "Employer EPS (8.33%)", "Employer EPF (3.67%)", "NCP Days",
        "Refund of Advance"
      ];
      
      const hdrRow = sheet.getRow(1);
      hdrRow.values = headers;
      hdrRow.height = 22;
      
      hdrRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      let o = 2;
      for (const p of payrolls) {
        if (p.grossWage > 0) {
          const row = sheet.getRow(o);
          row.values = [
            p.staff.payrollInfo?.uan || "", // removed the ' prefix
            p.staff.payrollInfo?.nameOnUan || p.staff.name,
            p.grossWage,
            p.epfWages,
            p.epsWages,
            p.edliWages,
            p.employeeEpf,
            p.employerEps,
            p.employerEpf,
            p.ncpDays,
            p.refundOfAdvance
          ];
          
          row.getCell(1).numFmt = '@';
          
          for(let i=3; i<=11; i++) {
             row.getCell(i).numFmt = '#,##0';
             row.getCell(i).alignment = { horizontal: 'right' };
             if(i === 10) row.getCell(i).alignment = { horizontal: 'center' };
          }

          row.eachCell(cell => {
             cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
             };
          });
          o++;
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Disposition": `attachment; filename="ECR_Final_${monthLabel.toUpperCase()}.xlsx"`,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });

    } else if (type === "ecr-text") {
      let textContent = "";
      for (const p of payrolls) {
        if (p.grossWage > 0) {
          const uan = p.staff.payrollInfo?.uan || "";
          const name = p.staff.payrollInfo?.nameOnUan || p.staff.name;
          const line = [
            uan,
            name,
            Math.round(p.grossWage),
            Math.round(p.epfWages),
            Math.round(p.epsWages),
            Math.round(p.edliWages),
            Math.round(p.employeeEpf),
            Math.round(p.employerEps),
            Math.round(p.employerEpf),
            p.ncpDays,
            p.refundOfAdvance
          ].join("#~#");
          
          textContent += line + "\n";
        }
      }

      const txtMonth = format(monthDate, "MMM");
      const txtYear = format(monthDate, "yyyy");

      return new NextResponse(textContent, {
        headers: {
          "Content-Disposition": `attachment; filename="ECR${txtMonth.toUpperCase()}${txtYear}.txt"`,
          "Content-Type": "text/plain",
        },
      });

    } else if (type === "bulk-reg") {
      let textContent = "";
      for (const p of payrolls) {
        const info = p.staff.payrollInfo;
        if (!info) continue;

        const line = [
          info.uan || "",
          info.previousMemberId || "",
          info.nameOnUan || p.staff.name,
          info.dob ? format(new Date(info.dob), "dd/MM/yyyy") : "",
          info.doj ? format(new Date(info.doj), "dd/MM/yyyy") : "",
          info.gender || "",
          info.fatherHusbandName || "",
          info.relationship || "",
          info.mobileNumber || "",
          info.email || "",
          info.nationality || "INDIAN",
          Math.round(p.grossWage || 0),
          info.qualification || "",
          info.maritalStatus || "",
          info.isInternationalWorker || "N",
          info.countryOfOrigin || "INDIA",
          info.passportNumber || "",
          info.passportValidFrom ? format(new Date(info.passportValidFrom), "dd/MM/yyyy") : "",
          info.passportValidTill ? format(new Date(info.passportValidTill), "dd/MM/yyyy") : "",
          info.isPhysicalHandicap || "N",
          info.locomotive || "N",
          info.hearing || "N",
          info.visual || "N",
          info.bankAccount || "",
          info.ifsc || "",
          info.nameAsPerBank || "",
          info.pan || "",
          info.nameOnPan || "",
          info.aadhaar || "",
          info.nameOnAadhaar || ""
        ].join("#~#");

        textContent += line + "\n";
      }

      const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
      return new NextResponse(textContent, {
        headers: {
          "Content-Disposition": `attachment; filename="EPFO_Bulk_Reg_${timestamp}.txt"`,
          "Content-Type": "text/plain",
        },
      });

    } else {
      return new NextResponse("Unknown export type", { status: 400 });
    }
  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}
