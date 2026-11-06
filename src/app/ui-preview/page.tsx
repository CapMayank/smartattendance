import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, AlarmClock, Users, Plus, Search, Inbox } from "lucide-react";
import {
  Avatar, Button, Card, CardHeader, EmptyState, Field, IconButton, Input, KpiTile, PageHeader,
  ProgressTrack, SectionLabel, Select, Skeleton, StatusBadge, Textarea, DeltaPill, Sparkline,
  type Status, type Tone,
} from "@/components/ui";
import { ChipsDemo, ModalDemo, PagerDemo, TabsDemo } from "./Demo";

const spark = [70, 74, 71, 76, 78, 75, 73];
const statuses: Status[] = ["on-duty", "left", "late", "absent", "half-day", "online", "offline", "locked"];
const tones: { tone: Tone; icon: typeof Users; label: string }[] = [
  { tone: "present", icon: CheckCircle2, label: "Present" },
  { tone: "late", icon: AlarmClock, label: "Late" },
  { tone: "absent", icon: XCircle, label: "Absent" },
  { tone: "leave", icon: Users, label: "On leave" },
  { tone: "accent", icon: Users, label: "Headcount" },
];

export default function UiPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-6 bg-canvas p-4 sm:p-6">
      <PageHeader
        title="UI preview"
        subtitle="Dev-only primitives gallery"
        actions={<><Button variant="secondary" icon={Plus}>Add</Button><Button>Primary</Button></>}
      />

      <SectionLabel>Buttons</SectionLabel>
      <div className="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button size="sm">Small</Button>
        <Button loading>Saving</Button>
        <Button disabled>Disabled</Button>
        <IconButton icon={Search} label="Search" />
      </div>

      <SectionLabel>KPI tiles</SectionLabel>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {tones.map((t) => (
          <KpiTile
            key={t.tone}
            tone={t.tone}
            icon={t.icon}
            label={t.label}
            value="73"
            total={84}
            delta={{ text: "4.2%", direction: "up", good: t.tone !== "absent" }}
            foot="vs yesterday"
            spark={spark}
          />
        ))}
        <KpiTile tone="present" icon={Users} label="No spark" value="12" />
      </div>
      <div className="flex gap-3">
        <DeltaPill text="1.1%" direction="down" good={false} />
        <DeltaPill text="0%" direction="flat" good />
        <div className="w-40"><Sparkline values={spark} tone="accent" /></div>
      </div>

      <SectionLabel>Badges, chips, tabs</SectionLabel>
      <div className="flex flex-wrap gap-2">{statuses.map((s) => <StatusBadge key={s} status={s} />)}</div>
      <ChipsDemo />
      <TabsDemo />

      <SectionLabel>Forms</SectionLabel>
      <Card>
        <CardHeader title="Employee" caption="Required fields" action={<a href="#" className="text-acc-2">Link</a>} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="p-name" helper="As on ID card"><Input id="p-name" placeholder="Full name" /></Field>
          <Field label="Role" htmlFor="p-role"><Select id="p-role"><option>Teacher</option><option>Admin</option></Select></Field>
          <Field label="Email" htmlFor="p-mail" error="Enter a valid email"><Input id="p-mail" aria-invalid="true" defaultValue="nope" /></Field>
          <Field label="Notes" htmlFor="p-notes"><Textarea id="p-notes" /></Field>
        </div>
      </Card>

      <SectionLabel>People, progress, table</SectionLabel>
      <Card>
        <div className="mb-4 flex items-center gap-4">
          <Avatar name="Asha Verma" status="present" />
          <Avatar name="Ravi" status="late" />
          <Avatar name="Meera K Singh" size={28} />
          <div className="w-48"><ProgressTrack value={6} max={8} /></div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>In</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Asha Verma</td><td className="num">08:52</td><td><StatusBadge status="on-duty" /></td></tr>
              <tr><td>Ravi Kumar</td><td className="num">09:41</td><td><StatusBadge status="late" /></td></tr>
              <tr><td>Meera Singh</td><td className="num">--:--</td><td><StatusBadge status="absent" /></td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3"><PagerDemo /></div>
      </Card>

      <SectionLabel>Empty, skeleton, modal</SectionLabel>
      <Card><EmptyState icon={Inbox} title="No records" hint="Nothing matches these filters." /></Card>
      <div className="flex gap-3"><Skeleton className="h-10 w-40" /><Skeleton className="h-10 w-24" /></div>
      <ModalDemo />
    </main>
  );
}
