import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FuturesTable } from "@/components/FuturesTable";
import { useFuturesData } from "@/hooks/useFuturesData";

const PRESET_SYMBOLS = [
  { symbol: "SQZ25", name: "3-Month SOFR" },
  { symbol: "RAZ25", name: "3-Month ESTR" },
  { symbol: "J8Z25", name: "3-Month SONIA" },
  { symbol: "T0Z25", name: "3-Month TONA" },
];

const Futures = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [symbolInput, setSymbolInput] = useState("SQZ25");
  const {
    data,
    isLoading,
    lastFetched,
    error,
    fetchData,
    symbol,
  } = useFuturesData();

  useEffect(() => {
    fetchData();
  }, []);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbolInput.trim()) {
      fetchData(symbolInput.trim().toUpperCase());
    }
  };

  const handlePresetClick = (presetSymbol: string) => {
    setSymbolInput(presetSymbol);
    fetchData(presetSymbol);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle gradient overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, hsl(200, 93%, 58%, 0.08) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10">
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Link to="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Bond Yields
                  </Button>
                </Link>
              </div>
              
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Futures Prices
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Interest Rate Futures - Real-time data from Barchart
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {lastFetched && (
                    <span className="text-xs text-muted-foreground">
                      Updated: {lastFetched}
                    </span>
                  )}
                  <Button
                    onClick={() => fetchData()}
                    disabled={isLoading}
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Preset Symbols */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground self-center mr-2">Quick Select:</span>
                {PRESET_SYMBOLS.map((preset) => (
                  <Button
                    key={preset.symbol}
                    variant={symbol === preset.symbol ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetClick(preset.symbol)}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    {preset.symbol} - {preset.name}
                  </Button>
                ))}
              </div>

              {/* Symbol Input & Search */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <form onSubmit={handleSymbolSubmit} className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Symbol (e.g., SQZ25)"
                    value={symbolInput}
                    onChange={(e) => setSymbolInput(e.target.value)}
                    className="w-40"
                  />
                  <Button type="submit" variant="secondary" size="sm" disabled={isLoading}>
                    Load
                  </Button>
                </form>
                
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search contracts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Symbol</p>
                <p className="text-2xl font-bold text-foreground">{symbol}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Contracts</p>
                <p className="text-2xl font-bold text-foreground">{data.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold text-foreground">
                  {data.reduce((sum, item) => sum + (item.volume || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Open Interest</p>
                <p className="text-2xl font-bold text-foreground">
                  {data.reduce((sum, item) => sum + (item.openInt || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Main Table */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Futures Contracts
              </h2>

              <FuturesTable
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
                  href="https://www.barchart.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Barchart
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

export default Futures;
