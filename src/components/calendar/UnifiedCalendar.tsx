"use client";

import React, { ReactNode } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSunday,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export const CALENDAR_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface CalendarLegendItem {
  label: string;
  dotClass: string;
  ringClass?: string;
}

export interface UnifiedCalendarProps {
  currentDate: Date;
  monthLabel?: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday?: () => void;
  isLoading?: boolean;
  legendItems?: CalendarLegendItem[];
  toolbarActions?: ReactNode;
  renderDay: (
    date: Date,
    info: {
      dateKey: string;
      dayNumber: number;
      isTodayDate: boolean;
      isSundayDate: boolean;
    }
  ) => ReactNode;
  className?: string;
}

export function UnifiedCalendar({
  currentDate,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
  isLoading = false,
  legendItems = [],
  toolbarActions,
  renderDay,
  className,
}: UnifiedCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Sunday

  const allGridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const displayMonthLabel = monthLabel || format(currentDate, "MMMM yyyy");

  return (
    <div
      className={cn(
        "flex-1 rounded-2xl border border-line bg-card shadow-sm overflow-hidden flex flex-col",
        className
      )}
    >
      {/* Integrated Card Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card-hi/40 px-4 py-3 sm:px-5">
        {/* Month Navigator Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card hover:bg-card-hi transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4 text-text" />
          </button>

          <div className="flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-acc-2" />
            <span className="num text-sm sm:text-base font-bold tracking-tight text-text">
              {displayMonthLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={onNextMonth}
            disabled={isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card hover:bg-card-hi transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4 text-text" />
          </button>

          {onGoToToday && (
            <Button
              variant="secondary"
              onClick={onGoToToday}
              className="h-8 px-2.5 text-xs ml-1 shadow-2xs"
            >
              Today
            </Button>
          )}

          {isLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted ml-1" />
          )}
        </div>

        {/* Micro-Legend & Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 text-xs text-muted">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  item.dotClass,
                  item.ringClass || "ring-2 ring-line"
                )}
              />
              <span className="font-semibold text-text">{item.label}</span>
            </div>
          ))}

          {toolbarActions && (
            <div className="flex items-center gap-2 border-l border-line-soft pl-3 ml-1">
              {toolbarActions}
            </div>
          )}
        </div>
      </div>

      {/* Responsive Horizontal Scroll Container */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px] sm:min-w-[700px]">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-line bg-card-hi/70 text-center text-xs font-semibold text-text">
            {CALENDAR_WEEKDAYS.map((name, i) => (
              <div
                key={name}
                className={cn(
                  "py-2.5 text-[11px] uppercase tracking-wider font-semibold",
                  i === 6 ? "text-muted" : "text-text"
                )}
              >
                {name}
              </div>
            ))}
          </div>

          {/* 7-Column Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-line">
            {allGridDays.map((day) => {
              const inCurrentMonth = isSameMonth(day, monthStart);
              const dateKey = format(day, "yyyy-MM-dd");
              const dayNumber = day.getDate();
              const isTodayDate = isToday(day);
              const isSundayDate = isSunday(day);

              if (!inCurrentMonth) {
                // Inactive leading / trailing month day: consistent across both portals
                return (
                  <div
                    key={day.toISOString()}
                    className="relative flex min-h-[130px] sm:min-h-[142px] flex-col justify-between p-2 sm:p-2.5 bg-canvas/30 transition-colors select-none"
                  >
                    <div className="flex items-center justify-between leading-none">
                      <span className="num text-xs sm:text-sm font-normal text-muted/40">
                        {format(day, "dd")}
                      </span>
                    </div>
                    <div className="my-auto" />
                  </div>
                );
              }

              // Active day in current month: render using slot
              return (
                <React.Fragment key={day.toISOString()}>
                  {renderDay(day, {
                    dateKey,
                    dayNumber,
                    isTodayDate,
                    isSundayDate,
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
