import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useVCFundStore } from '../lib/store';
import { toast } from 'sonner';
import { Copy, Share2, Save, FileDown, FileUp, Download } from 'lucide-react';

export function ShareDialog() {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const { exportParameters } = useVCFundStore();

  const generateShareUrl = () => {
    try {
      const params = exportParameters();
      const url = `${window.location.origin}${window.location.pathname}?params=${params}`;
      setShareUrl(url);
      return url;
    } catch (error) {
      console.error("Error generating share URL:", error);
      toast.error("Failed to generate share URL");
      return "";
    }
  };

  const handleOpen = () => {
    generateShareUrl();
    setOpen(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share URL copied to clipboard");
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={handleOpen}
        >
          <Share2 className="h-4 w-4" />
          <span>Share Parameters</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Simulation Parameters</DialogTitle>
          <DialogDescription>
            Share this URL to allow others to run the same simulation with your
            exact parameters.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 mt-2">
          <div className="grid flex-1 gap-2">
            <Input value={shareUrl} readOnly className="w-full" />
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={copyToClipboard}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter className="sm:justify-start">
          <div className="text-sm text-gray-500 mt-2">
            Anyone with this link can view and run your simulation with the exact
            same parameters.
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoadSharedParameters() {
  const { importParameters } = useVCFundStore();

  const loadFromUrl = () => {
    try {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const params = url.searchParams.get("params");

        if (params) {
          const success = importParameters(params);
          if (success) {
            toast.success("Successfully loaded shared parameters");
            // Remove params from URL without reloading
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          } else {
            toast.error("Failed to load shared parameters");
          }
        }
      }
    } catch (error) {
      console.error("Error loading shared parameters:", error);
    }
  };

  // Load parameters on mount
  React.useEffect(() => {
    loadFromUrl();
  }, []);

  return null;
}

export function SaveSimulationResults({
  resultsRef,
}: {
  resultsRef: React.RefObject<HTMLDivElement>;
}) {
  const {
    exportParameters,
    isPortfolioMode,
    simulationResults,
    portfolioSimulationResults,
  } = useVCFundStore();
  
  const results = isPortfolioMode ? portfolioSimulationResults : simulationResults;

  const saveAsImage = async () => {
    if (!resultsRef.current || !results) {
      toast.error("No simulation results to save");
      return;
    }

    try {
      toast.info("Preparing image, please wait...");
      
      // Use window.print() as a simple alternative since we don't have html2canvas
      window.print();
      toast.success("Print dialog opened. Save as PDF for image");
      
    } catch (error) {
      console.error("Error saving image:", error);
      toast.error("Failed to save image");
    }
  };

  const saveAsJSON = () => {
    if (!results) {
      toast.error("No simulation results to save");
      return;
    }

    try {
      // Create an export object with both parameters and results
      const exportData = {
        parameters: JSON.parse(atob(exportParameters())),
        results: results,
        timestamp: new Date().toISOString(),
        mode: isPortfolioMode ? "portfolio" : "standard",
      };

      // Convert to JSON string
      const jsonStr = JSON.stringify(exportData, null, 2);

      // Create a blob and download
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `vc-simulation-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);

      toast.success("Simulation results saved as JSON");
    } catch (error) {
      console.error("Error saving results as JSON:", error);
      toast.error("Failed to save results as JSON");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-1"
        onClick={saveAsImage}
        disabled={!results}
      >
        <Download className="h-4 w-4" />
        Print Results
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-1"
        onClick={saveAsJSON}
        disabled={!results}
      >
        <Save className="h-4 w-4" />
        Save Results
      </Button>
    </div>
  );
}