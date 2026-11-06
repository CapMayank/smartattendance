"use client";

import { useState } from "react";
import { Chip, ChipGroup, Modal, Button, Pagination, Tabs } from "@/components/ui";

export function ChipsDemo() {
  const [on, setOn] = useState("all");
  return (
    <ChipGroup label="Filter">
      <Chip pressed={on === "all"} onClick={() => setOn("all")} count={42}>All</Chip>
      <Chip pressed={on === "present"} onClick={() => setOn("present")} dot="present" count={31}>Present</Chip>
      <Chip pressed={on === "late"} onClick={() => setOn("late")} dot="late" count={6}>Late</Chip>
      <Chip pressed={on === "absent"} onClick={() => setOn("absent")} dot="absent" count={5}>Absent</Chip>
    </ChipGroup>
  );
}

export function TabsDemo() {
  const [v, setV] = useState("staff");
  return (
    <Tabs
      value={v}
      onChange={setV}
      tabs={[
        { id: "staff", label: "Staff", count: 42 },
        { id: "devices", label: "Devices", count: 3 },
        { id: "log", label: "Log" },
      ]}
    />
  );
}

export function PagerDemo() {
  const [p, setP] = useState(3);
  return <Pagination page={p} pageCount={12} onPage={setP} />;
}

export function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit shift"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Save</Button>
          </>
        }
      >
        <p className="text-sm text-muted">Esc closes this dialog and focus returns to the trigger.</p>
      </Modal>
    </>
  );
}
