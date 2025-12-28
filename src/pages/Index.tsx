import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsCards } from "@/components/StatsCards";
import { YieldTable } from "@/components/YieldTable";
import { useYieldData } from "@/hooks/useYieldData";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { InterpolationMethod } from "@/lib/bootstrapping";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    data,
    maturities,
    isLoading,
    lastFetched,
    fetchData,
    totalCountries,
    loadedCountries,
    bootstrapMethod,
    setBootstrapMethod,
    enableBootstrapping,
    setEnableBootstrapping,
    interpolatedValues,
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
            {/* Navigation */}
            <div className="flex items-center gap-4">
              <Link to="/futures">
                <Button variant="outline" size="sm" className="gap-2">
                  Futures Prices
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Government Bond Yields
                </h2>
                
                {/* Bootstrapping Controls */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="bootstrap-toggle"
                      checked={enableBootstrapping}
                      onCheckedChange={setEnableBootstrapping}
                    />
                    <Label htmlFor="bootstrap-toggle" className="text-sm text-muted-foreground cursor-pointer">
                      Bootstrapping
                    </Label>
                  </div>
                  
                  {enableBootstrapping && (
                    <Select
                      value={bootstrapMethod}
                      onValueChange={(value) => setBootstrapMethod(value as InterpolationMethod)}
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Méthode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linear">Linéaire</SelectItem>
                        <SelectItem value="cubic-spline">Cubic Spline</SelectItem>
                        <SelectItem value="nelson-siegel">Nelson-Siegel</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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
                {enableBootstrapping && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-interpolated" />
                    Interpolé*
                  </span>
                )}
              </div>

              <YieldTable
                data={data}
                maturities={maturities}
                isLoading={isLoading}
                searchQuery={searchQuery}
                interpolatedValues={interpolatedValues}
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
                {enableBootstrapping && (
                  <span className="ml-2">
                    * Valeurs interpolées via bootstrapping ({bootstrapMethod === 'nelson-siegel' ? 'Nelson-Siegel' : bootstrapMethod === 'cubic-spline' ? 'Cubic Spline' : 'Linéaire'}).
                  </span>
                )}
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
