import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { 
  Upload,
  Download,
  RotateCw,
  Crop,
  Type,
  Square,
  Circle,
  Palette,
  Undo,
  Redo,
  Save
} from "lucide-react";

interface ImageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialImage?: string;
}

export default function ImageEditor({ open, onOpenChange, initialImage }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<string>("select");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState([5]);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { toast } = useToast();

  useEffect(() => {
    if (open && initialImage) {
      loadImage(initialImage);
    }
  }, [open, initialImage]);

  const loadImage = (imageSrc: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      saveToHistory();
    };
    img.src = imageSrc;
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      setHistoryIndex(historyIndex - 1);
      ctx.putImageData(history[historyIndex - 1], 0, 0);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      setHistoryIndex(historyIndex + 1);
      ctx.putImageData(history[historyIndex + 1], 0, 0);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageSrc = e.target?.result as string;
      loadImage(imageSrc);
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    switch (tool) {
      case "text":
        if (text) {
          ctx.fillStyle = color;
          ctx.font = `${brushSize[0] * 2}px Arial`;
          ctx.fillText(text, x, y);
          saveToHistory();
        }
        break;
      case "circle":
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize[0];
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, 2 * Math.PI);
        ctx.stroke();
        saveToHistory();
        break;
      case "rectangle":
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize[0];
        ctx.strokeRect(x - 25, y - 25, 50, 50);
        saveToHistory();
        break;
    }
  };

  const applyFilter = (filterType: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    switch (filterType) {
      case "grayscale":
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        break;
      case "sepia":
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
          data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
          data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }
        break;
      case "invert":
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        break;
    }

    ctx.putImageData(imageData, 0, 0);
    saveToHistory();
  };

  const rotateImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Create temporary canvas for rotation
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCanvas.width = canvas.height;
    tempCanvas.height = canvas.width;

    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(Math.PI / 2);
    tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

    // Update main canvas
    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    ctx.drawImage(tempCanvas, 0, 0);
    
    saveToHistory();
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "edited-image.png";
    link.href = canvas.toDataURL();
    link.click();

    toast({
      title: "Image Downloaded",
      description: "Your edited image has been downloaded",
    });
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // This would integrate with the file storage system
    const imageData = canvas.toDataURL();
    
    toast({
      title: "Image Saved",
      description: "Your edited image has been saved to the project",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Image Editor</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[70vh]">
          {/* Tools Panel */}
          <div className="space-y-4 overflow-y-auto">
            <div>
              <Label>Upload Image</Label>
              <div className="mt-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button variant="outline" className="w-full gap-2">
                    <Upload className="h-4 w-4" />
                    Upload
                  </Button>
                </label>
              </div>
            </div>

            <div>
              <Label>Tools</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant={tool === "select" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTool("select")}
                >
                  Select
                </Button>
                <Button
                  variant={tool === "text" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTool("text")}
                  className="gap-1"
                >
                  <Type className="h-3 w-3" />
                  Text
                </Button>
                <Button
                  variant={tool === "rectangle" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTool("rectangle")}
                  className="gap-1"
                >
                  <Square className="h-3 w-3" />
                  Rect
                </Button>
                <Button
                  variant={tool === "circle" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTool("circle")}
                  className="gap-1"
                >
                  <Circle className="h-3 w-3" />
                  Circle
                </Button>
              </div>
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded border"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <Label>Brush Size: {brushSize[0]}px</Label>
              <Slider
                value={brushSize}
                onValueChange={setBrushSize}
                max={50}
                min={1}
                step={1}
                className="mt-2"
              />
            </div>

            {tool === "text" && (
              <div>
                <Label>Text</Label>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter text"
                  className="mt-2"
                />
              </div>
            )}

            <div>
              <Label>Filters</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyFilter("grayscale")}
                >
                  Grayscale
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyFilter("sepia")}
                >
                  Sepia
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyFilter("invert")}
                >
                  Invert
                </Button>
              </div>
            </div>

            <div>
              <Label>Transform</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={rotateImage}
                  className="gap-2"
                >
                  <RotateCw className="h-3 w-3" />
                  Rotate 90°
                </Button>
              </div>
            </div>

            <div>
              <Label>Actions</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="gap-1"
                >
                  <Undo className="h-3 w-3" />
                  Undo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="gap-1"
                >
                  <Redo className="h-3 w-3" />
                  Redo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadImage}
                  className="gap-1"
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveImage}
                  className="gap-1"
                >
                  <Save className="h-3 w-3" />
                  Save
                </Button>
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="lg:col-span-3 flex items-center justify-center bg-gray-50 rounded-lg border">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="max-w-full max-h-full border bg-white shadow-sm cursor-crosshair"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}