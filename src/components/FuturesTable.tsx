import { useMemo } from "react";
import { FuturesData } from "@/types/futures";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface FuturesTableProps {
  data: FuturesData[];
  isLoading: boolean;
  searchQuery?: string;
}

function formatNumber(value: number | null, decimals: number = 4): string {
  if (value === null || value === undefined) return "-";
  return value.toFixed(decimals);
}

function formatVolume(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString();
}

function getChangeColor(change: number | null, changePercent: string): string {
  if (changePercent === "unch") return "text-muted-foreground";
  if (change === null) return "text-muted-foreground";
  if (change > 0) return "text-emerald-500";
  if (change < 0) return "text-red-500";
  return "text-muted-foreground";
}

function SkeletonRow() {
  return (
    <TableRow>
      {Array(10).fill(0).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function FuturesTable({ data, isLoading, searchQuery = "" }: FuturesTableProps) {
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter((item) =>
      item.contract.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  if (isLoading && data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-foreground">Contract</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Latest</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Change</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Open</TableHead>
                <TableHead className="font-semibold text-foreground text-right">High</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Low</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Previous</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Volume</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Open Int</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array(10).fill(0).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (!isLoading && filteredData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        {searchQuery ? "No contracts match your search." : "No futures data available. Click Refresh to load data."}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-foreground sticky left-0 bg-muted/50 z-10">Contract</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Latest</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Change</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Open</TableHead>
              <TableHead className="font-semibold text-foreground text-right">High</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Low</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Previous</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Volume</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Open Int</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item, index) => (
              <TableRow
                key={item.contract}
                className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
              >
                <TableCell className="font-medium text-primary sticky left-0 bg-inherit z-10">
                  {item.contractUrl ? (
                    <a
                      href={item.contractUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {item.contract}
                    </a>
                  ) : (
                    item.contract
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatNumber(item.latest)}
                </TableCell>
                <TableCell className={`text-right font-mono text-sm ${getChangeColor(item.change, item.changePercent)}`}>
                  {item.changePercent === "unch" ? "unch" : (item.change !== null ? (item.change >= 0 ? "+" : "") + formatNumber(item.change) : "-")}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatNumber(item.open)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatNumber(item.high)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatNumber(item.low)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatNumber(item.previous)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatVolume(item.volume)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatVolume(item.openInt)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {item.time}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
