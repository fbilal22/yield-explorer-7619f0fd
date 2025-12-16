import { useMemo } from "react";
import { CountryYieldData } from "@/types/yield";
import { maturities } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface YieldTableProps {
  data: CountryYieldData[];
  isLoading?: boolean;
  searchQuery?: string;
}

function formatRate(rate: number | null): string {
  if (rate === null || rate === undefined) return "—";
  return rate.toFixed(2) + "%";
}

function getRateColor(rate: number | null): string {
  if (rate === null || rate === undefined) return "text-muted-foreground";
  if (rate < 0) return "text-rate-negative";
  if (rate < 2) return "text-accent";
  if (rate < 5) return "text-foreground";
  if (rate < 10) return "text-warning";
  return "text-rate-negative";
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border/50">
      <td className="px-4 py-3 sticky left-0 bg-card z-10">
        <div className="h-4 w-24 skeleton-shimmer rounded" />
      </td>
      {maturities.map((m) => (
        <td key={m} className="table-cell">
          <div className="h-4 w-12 skeleton-shimmer rounded ml-auto" />
        </td>
      ))}
    </tr>
  );
}

export function YieldTable({ data, isLoading, searchQuery }: YieldTableProps) {
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (country) =>
        country.country.toLowerCase().includes(query) ||
        country.slug.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-table-header border-b border-border">
              <th className="px-4 py-3 text-left font-semibold text-sm text-muted-foreground sticky left-0 bg-table-header z-20 min-w-[180px]">
                Country
              </th>
              {maturities.map((maturity) => (
                <th
                  key={maturity}
                  className="px-3 py-3 text-right font-semibold text-sm text-muted-foreground min-w-[80px]"
                >
                  {maturity}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={maturities.length + 1}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {searchQuery
                    ? "No countries match your search"
                    : "No data available"}
                </td>
              </tr>
            ) : (
              filteredData.map((country, index) => (
                <tr
                  key={country.slug}
                  className={cn(
                    "border-b border-border/50 transition-colors hover:bg-table-row-hover animate-fade-in",
                    country.error && "opacity-60"
                  )}
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <td className="px-4 py-3 sticky left-0 bg-card z-10 font-medium text-sm group-hover:bg-table-row-hover">
                    <div className="flex items-center gap-2">
                      <span>{country.country}</span>
                      {country.error && (
                        <span className="text-xs text-rate-negative">⚠</span>
                      )}
                    </div>
                  </td>
                  {maturities.map((maturity) => {
                    const rate = country.rates[maturity];
                    return (
                      <td
                        key={maturity}
                        className={cn(
                          "table-cell",
                          getRateColor(rate)
                        )}
                      >
                        {formatRate(rate)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
