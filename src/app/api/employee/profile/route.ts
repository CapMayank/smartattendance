import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

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
      payrollInfo: true,
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

  const info = staff.payrollInfo;
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
      dob: info?.dob
        ? typeof info.dob === "string"
          ? info.dob
          : info.dob.toISOString().split("T")[0]
        : "",
      gender: info?.gender ?? "",
      fatherHusbandName: info?.fatherHusbandName ?? "",
      relationship: info?.relationship ?? "",
      qualification: info?.qualification ?? "",
      bankAccount: info?.bankAccount ?? "",
      ifsc: info?.ifsc ?? "",
      nameAsPerBank: info?.nameAsPerBank ?? "",
      pan: info?.pan ?? "",
      aadhaar: info?.aadhaar ?? "",
      uan: info?.uan ?? "",
    },
  });
}
