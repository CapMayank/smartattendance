import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlarmClock, BarChart3, CheckCircle2, DatabaseZap, Fingerprint, Sunrise, XCircle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import AutoRefresh from "@/components/AutoRefresh";
import { Card, CardHeader, EmptyState, KpiTile, SectionLabel, PageHeader } from "@/components/ui";
import { getDashboardData, istDateKey, type DashboardData } from "@/lib/dashboard";
import { getEmployeePortalData } from "@/lib/employee-portal";
import { istMinutes, turnoutPercent } from "@/lib/dashboard-calc";
import { formatDateLong, formatTime, formatHHmm } from "@/lib/format";
import { ArrivalsChart } from "@/components/dashboard/ArrivalsChart";
import { StatusRing } from "@/components/dashboard/StatusRing";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { DepartmentTurnout } from "@/components/dashboard/DepartmentTurnout";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { StaffToday } from "@/components/dashboard/StaffToday";
import { EmployeeMyDashboard } from "@/components/dashboard/EmployeeMyDashboard";

/** Dev-only `?at=<ISO>` override of "now" for checking other days. */
function resolveNow(at: string | string[] | undefined): Date {
  if (process.env.NODE_ENV !== "production" && typeof at === "string") {
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function greeting(now: Date) {
  const m = istMinutes(now);
  if (m < 12 * 60) return "Good morning";
  if (m < 17 * 60) return "Good afternoon";
  return "Good evening";
}

function medianArrival(staff: DashboardData["staff"]): string | null {
  const firsts = staff
    .filter((s) => s.punches.length > 0)
    .map((s) => s.punches[0].at)
    .sort();
  if (firsts.length === 0) return null;
  return formatTime(new Date(firsts[Math.floor((firsts.length - 1) / 2)]));
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const now = resolveNow((await searchParams).at);
  const firstName = (session.user?.name ?? "").trim().split(/\s+/)[0] || "there";
  const title = `${greeting(now)}, ${firstName}`;

  // Employee Role: Render the personal "My" Portal instead of the school-wide admin dashboard
  if (session.user?.role === "EMPLOYEE" && session.user?.staffId) {
    const portalData = await getEmployeePortalData(session.user.staffId, now).catch((err) => {
      console.error("[employee-portal] failed to load data:", err);
      return null;
    });

    if (portalData) {
      const empSubtitle = [
        formatDateLong(now),
        formatTime(now),
        portalData.profile.employeeCode ? `ID ${portalData.profile.employeeCode}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return (
        <>
          <AutoRefresh />
          <EmployeeMyDashboard title={title} subtitle={empSubtitle} data={portalData} />
        </>
      );
    }
  }

  let data: DashboardData;
  try {
    data = await getDashboardData(now);
  } catch (err) {
    console.error("[dashboard] failed to load data:", err);
    return (
      <div className="flex flex-col gap-[22px]">
        <PageHeader title={title} subtitle={`${formatDateLong(now)} · ${formatTime(now)}`} />
        <Card>
          <EmptyState
            icon={DatabaseZap}
            title="Attendance data is unavailable"
            hint="The database could not be reached. The page will refresh when punches arrive."
          />
        </Card>
        <AutoRefresh />
      </div>
    );
  }

  const { kpis, workingDay } = data;
  const shift = data.commonShift;
  const subtitle = [
    formatDateLong(now),
    formatTime(now),
    shift ? `Shift ${formatHHmm(shift.start)}–${formatHHmm(shift.end)}` : null,
    data.graceLabel ? `Grace till ${data.graceLabel}` : null,
    workingDay ? null : `${data.offDayName} · no attendance expected`,
  ]
    .filter(Boolean)
    .join(" · ");

  const turnout = workingDay ? turnoutPercent(kpis.inToday, kpis.total) : null;
  const lateRows = data.staff.filter((s) => s.status === "late");
  const avgLate = lateRows.length ? Math.round(lateRows.reduce((n, s) => n + s.lateBy, 0) / lateRows.length) : 0;
  const devicesOffline = kpis.devicesTotal - kpis.devicesOnline;
  const arrivalsTotal = data.arrivals.reduce((n, b) => n + b.onTime + b.late, 0);
  const onTimeArrivals = data.arrivals.reduce((n, b) => n + b.onTime, 0);
  const median = medianArrival(data.staff);
  const trendTotal = data.trend.reduce((n, d) => n + d.onTime + d.late, 0);
  const todayInTrend = data.trend.at(-1)?.date === istDateKey(now);

  return (
    <div className="flex flex-col gap-[22px]">
      <AutoRefresh />
      <PageHeader title={title} subtitle={subtitle} />

      <SectionLabel>Today</SectionLabel>

      <section aria-label="Today at a glance" className="grid grid-cols-1 gap-3.5 min-[600px]:grid-cols-2 min-[1100px]:grid-cols-4">
        <KpiTile
          tone="present"
          icon={CheckCircle2}
          label="In today"
          value={kpis.inToday}
          total={kpis.total}
          delta={workingDay ? { ...kpis.deltas.in, good: kpis.deltas.in.direction === "up" } : undefined}
          foot={
            workingDay
              ? turnout === null
                ? "No staff on roll"
                : `${turnout}% turnout`
              : `${data.offDayName} · off day`
          }
          spark={kpis.spark.in}
        />
        <KpiTile
          tone="late"
          icon={AlarmClock}
          label="Late arrivals"
          value={kpis.late}
          delta={workingDay ? { ...kpis.deltas.late, good: kpis.deltas.late.direction === "down" } : undefined}
          foot={kpis.late ? `Avg ${avgLate} min after shift start` : "Nobody late so far"}
          spark={kpis.spark.late}
        />
        <KpiTile
          tone="absent"
          icon={XCircle}
          label="Absent"
          value={kpis.absent}
          delta={workingDay ? { ...kpis.deltas.absent, good: kpis.deltas.absent.direction === "down" } : undefined}
          foot={workingDay ? "No punch today" : `Not counted on ${data.offDayName}`}
          spark={kpis.spark.absent}
        />
        <KpiTile
          tone="accent"
          icon={Fingerprint}
          label="Devices online"
          value={kpis.devicesOnline}
          total={kpis.devicesTotal}
          foot={
            kpis.devicesTotal === 0
              ? "No devices registered"
              : devicesOffline === 0
                ? "All devices reporting"
                : `${devicesOffline} offline · pinged in last 5 min`
          }
          spark={kpis.spark.devices}
        />
      </section>

      <section className="grid grid-cols-1 gap-3.5 min-[1240px]:grid-cols-12">
        <Card className="min-[1240px]:col-span-7">
          <CardHeader title="Arrivals this morning" caption="First punch of each staff member, in 15-minute slots" />
          {arrivalsTotal === 0 ? (
            <EmptyState
              icon={Sunrise}
              title={workingDay ? "No arrivals yet" : "No arrivals today"}
              hint={workingDay ? "First punches will appear here as staff arrive." : `${data.offDayName} is not a working day.`}
            />
          ) : (
            <>
              <ArrivalsChart arrivals={data.arrivals} graceLabel={data.graceLabel} />
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                <span className="inline-flex items-center gap-[7px]">
                  <i className="size-2.5 rounded-[3px] bg-present" aria-hidden="true" />
                  On time · <span className="num">{onTimeArrivals}</span>
                </span>
                <span className="inline-flex items-center gap-[7px]">
                  <i className="size-2.5 rounded-[3px] bg-late" aria-hidden="true" />
                  Late · <span className="num">{arrivalsTotal - onTimeArrivals}</span>
                </span>
                {median ? (
                  <span className="text-subtle">
                    Median arrival <b className="num font-medium text-text">{median}</b>
                  </span>
                ) : null}
              </div>
            </>
          )}
        </Card>

        <Card className="min-[1240px]:col-span-5">
          <CardHeader title="Where everyone is" caption={`${kpis.total} staff on roll`} />
          <StatusRing {...data.ring} />
        </Card>

        <Card className="min-[1240px]:col-span-7">
          <CardHeader
            title="Departments today"
            action={
              <Link href="/departments" className="text-acc-2 hover:underline">
                Open departments
              </Link>
            }
          />
          <DepartmentTurnout departments={data.departments} />
        </Card>

        <Card className="min-[1240px]:col-span-5">
          <CardHeader
            title="Needs your attention"
            caption={
              data.attention.length ? (
                <span className="num">
                  {data.attention.length} items{data.attentionMore > 0 ? ` · +${data.attentionMore} more` : ""}
                </span>
              ) : undefined
            }
          />
          <AttentionList items={data.attention} />
        </Card>
      </section>

      <SectionLabel>Last 3 weeks</SectionLabel>

      <Card as="section">
        <CardHeader
          title="Staff present per working day"
          caption={`Saturdays are half days${todayInTrend ? ` · today counted up to ${formatTime(now)}` : ""}`}
        />
        {trendTotal === 0 ? (
          <EmptyState icon={BarChart3} title="No punches in the last 3 weeks" />
        ) : (
          <>
            <TrendChart trend={data.trend} total={kpis.total} />
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-[7px]">
                <i className="size-2.5 rounded-[3px] bg-linear-to-b from-acc-1 to-acc-2" aria-hidden="true" />
                On time
              </span>
              <span className="inline-flex items-center gap-[7px]">
                <i className="size-2.5 rounded-[3px] bg-late" aria-hidden="true" />
                Late
              </span>
              <span className="inline-flex items-center gap-[7px]">
                <i className="size-2.5 rounded-[3px] bg-acc-2/45" aria-hidden="true" />
                Saturday
              </span>
            </div>
          </>
        )}
      </Card>

      <SectionLabel>Staff</SectionLabel>

      <StaffToday staff={data.staff} punchLog={data.punchLog} workingDay={workingDay} now={data.now} />
    </div>
  );
}
