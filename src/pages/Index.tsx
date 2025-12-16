import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsCards } from "@/components/StatsCards";
import { YieldTable } from "@/components/YieldTable";
import { useYieldData } from "@/hooks/useYieldData";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    data,
    isLoading,
    lastFetched,
    fetchData,
    totalCountries,
    loadedCountries,
  } = useYieldData();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle gradient overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, hsl(45, 93%, 58%, 0.08) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10">
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {/* Header */}
            <DashboardHeader
              onRefresh={fetchData}
              isLoading={isLoading}
              lastUpdated={lastFetched || undefined}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              totalCountries={totalCountries}
              loadedCountries={loadedCountries}
            />

            {/* Stats */}
            <StatsCards data={data} />

            {/* Main Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Government Bond Yields
                </h2>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    Low (&lt;2%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-foreground" />
                    Medium (2-5%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    High (5-10%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rate-negative" />
                    Very High (&gt;10%)
                  </span>
                </div>
              </div>

              <YieldTable
                data={data}
                isLoading={isLoading}
                searchQuery={searchQuery}
              />
            </div>

            {/* Footer */}
            <footer className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
              <p>
                Data sourced from{" "}
                <a
                  href="https://www.worldgovernmentbonds.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  World Government Bonds
                </a>
                . Updated periodically.
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
