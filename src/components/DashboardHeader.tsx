import { RefreshCw, TrendingUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface DashboardHeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCountries: number;
  loadedCountries: number;
}

export function DashboardHeader({
  onRefresh,
  isLoading,
  lastUpdated,
  searchQuery,
  onSearchChange,
  totalCountries,
  loadedCountries,
}: DashboardHeaderProps) {
  return (
    <div className="space-y-6">
      {/* Title Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="gradient-gold-text">Yield Curve</span>{" "}
              <span className="text-foreground">Dashboard</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Global government bond yields across maturities
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Last updated: {lastUpdated}
            </span>
          )}
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Controls Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search countries..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-secondary/50 border-border"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="region">
            {loadedCountries} / {totalCountries} countries
          </Badge>
          {isLoading && (
            <Badge variant="warning" className="animate-pulse">
              Fetching data...
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
