import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { evaluateEmployeeKycAndEpfoReadiness } from "@/lib/epfo/validation";

export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await requireRole(session, ["EMPLOYEE", "APPROVER", "ADMIN"]);
  if (auth.errorResponse) return auth.errorResponse;

  const staffId = auth.user.staffId ?? auth.user.staff?.id;
  if (!staffId) {
    return NextResponse.json(
      { error: "No linked staff profile found for this user account" },
      { status: 400 }
    );
  }

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    include: {
      payrollInfo: {
        include: {
          payGroupChanges: true,
        },
      },
      employmentPeriods: {
        orderBy: {
          startDate: "desc",
        },
      },
      department: true,
      designation: true,
      shift: true,
      user: true,
    },
  });

  if (!staff) {
    return NextResponse.json(
      { error: "Staff member not found" },
      { status: 404 }
    );
  }

  const pendingRequest = prisma.profileChangeRequest?.findFirst
    ? await prisma.profileChangeRequest.findFirst({
        where: {
          staffId,
          status: "PENDING",
        },
        select: { id: true },
      })
    : null;

  const info = staff.payrollInfo;
  const isBankEpf = (info?.payGroup || "BANK_EPF") === "BANK_EPF";
  let ready = true;
  let missingFields: string[] = [];

  if (isBankEpf) {
    const res = evaluateEmployeeKycAndEpfoReadiness(staff as any);
    ready = res.ready;
    missingFields = res.errors.map((e) => e.message);
  }

  const epfoReadiness = {
    isBankEpf,
    ready,
    missingFields,
    hasPendingRequest: Boolean(pendingRequest),
  };

  const toIsoDateStr = (val: Date | string | null | undefined): string => {
    if (!val) return "";
    if (val instanceof Date) return isNaN(val.getTime()) ? "" : val.toISOString().slice(0, 10);
    return String(val).slice(0, 10);
  };

  return NextResponse.json({
    profile: {
      id: staff.id,
      name: staff.name,
      employeeCode: staff.employeeCode,
      machineId: staff.machineId,
      department: staff.department ? { id: staff.department.id, name: staff.department.name } : null,
      designation: staff.designation ? { id: staff.designation.id, name: staff.designation.name } : null,
      shift: staff.shift
        ? {
            id: staff.shift.id,
            name: staff.shift.name,
            startTime: staff.shift.startTime,
            endTime: staff.shift.endTime,
          }
        : null,
      email: staff.user?.email ?? info?.email ?? "",
      mobileNumber: info?.mobileNumber ?? "",
      dob: toIsoDateStr(info?.dob),
      gender: info?.gender ?? "",
      fatherHusbandName: info?.fatherHusbandName ?? "",
      relationship: info?.relationship ?? "",
      qualification: info?.qualification ?? "",
      maritalStatus: info?.maritalStatus ?? "",
      nationality: info?.nationality ?? "INDIAN",
      bankAccount: info?.bankAccount ?? "",
      ifsc: info?.ifsc ?? "",
      nameAsPerBank: info?.nameAsPerBank ?? "",
      pan: info?.pan ?? "",
      nameOnPan: info?.nameOnPan ?? "",
      aadhaar: info?.aadhaar ?? "",
      nameOnAadhaar: info?.nameOnAadhaar ?? "",
      uan: info?.uan ?? "",
      nameOnUan: info?.nameOnUan ?? "",
      previousMemberId: info?.previousMemberId ?? "",
      isInternationalWorker: info?.isInternationalWorker ?? "N",
      countryOfOrigin: info?.countryOfOrigin ?? "INDIA",
      passportNumber: info?.passportNumber ?? "",
      passportValidFrom: toIsoDateStr(info?.passportValidFrom),
      passportValidTill: toIsoDateStr(info?.passportValidTill),
      isPhysicalHandicap: info?.isPhysicalHandicap ?? "N",
      locomotive: info?.locomotive ?? "N",
      hearing: info?.hearing ?? "N",
      visual: info?.visual ?? "N",
      epfoReadiness,
    },
  });
}
