import { Building2 } from "lucide-react";
import { EmptyState, ProgressTrack } from "@/components/ui";

export function DepartmentTurnout({ departments }: { departments: { name: string; present: number; total: number }[] }) {
  if (departments.length === 0) {
    return <EmptyState icon={Building2} title="No staff on roll" hint="Add staff to see department turnout." />;
  }
  return (
    <ul className="grid grid-cols-1 gap-x-[26px] gap-y-3 min-[600px]:grid-cols-2">
      {departments.map((d) => (
        <li key={d.name} className="min-w-0">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="size-2 flex-none rounded-full bg-acc-2" aria-hidden="true" />
            <span className="min-w-0 truncate text-text">{d.name}</span>
            <b className="num ml-auto font-medium text-text">
              {d.present}
              <small className="font-normal text-subtle"> / {d.total}</small>
            </b>
          </div>
          <div className="mt-[7px]">
            <ProgressTrack value={d.present} max={d.total} />
          </div>
        </li>
      ))}
    </ul>
  );
}
