import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  HelpCircle, 
  Search,
  Book,
  Star,
  ExternalLink,
  Loader2
} from "lucide-react";
import { useBackend } from '../hooks/useBackend';

interface HelpTopic {
  id: string;
  title: string;
  category: "getting-started" | "features" | "troubleshooting" | "api" | "examples";
  content: string;
  tags: string[];
  lastUpdated: Date;
}

interface SearchResult {
  topic: HelpTopic;
  relevanceScore: number;
  matchedContent: string;
}

const categoryColors = {
  "getting-started": "bg-green-100 text-green-800",
  "features": "bg-blue-100 text-blue-800",
  "troubleshooting": "bg-red-100 text-red-800",
  "api": "bg-purple-100 text-purple-800",
  "examples": "bg-orange-100 text-orange-800"
};

export default function HelpDialog() {
  const backend = useBackend();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadCategories();
      if (!searchQuery) {
        loadAllTopics();
      }
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery) {
      searchTopics();
    } else if (open) {
      loadAllTopics();
    }
  }, [searchQuery, selectedCategory]);

  const loadCategories = async () => {
    try {
      const response = await backend.help.listCategories();
      setCategories(response.categories);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadAllTopics = async () => {
    setLoading(true);
    try {
      const response = await backend.help.searchHelp({ 
        category: selectedCategory || undefined 
      });
      setSearchResults(response.results);
    } catch (error) {
      console.error("Failed to load topics:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchTopics = async () => {
    setLoading(true);
    try {
      const response = await backend.help.searchHelp({ 
        query: searchQuery,
        category: selectedCategory || undefined 
      });
      setSearchResults(response.results);
    } catch (error) {
      console.error("Failed to search topics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicClick = async (topicId: string) => {
    try {
      const response = await backend.help.getHelpTopic({ id: topicId });
      if (response.topic) {
        setSelectedTopic(response.topic);
      }
    } catch (error) {
      console.error("Failed to load topic:", error);
    }
  };

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering - in a real app, use a proper markdown parser
    return content
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mt-5 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('- ')) {
          return (
            <li key={index} className="ml-4 mb-1">
              {line.slice(2)}
            </li>
          );
        }
        if (line.trim() === '') {
          return <br key={index} />;
        }
        return <p key={index} className="mb-2 leading-relaxed">{line}</p>;
      });
  };

  const getRelevanceStars = (score: number) => {
    const stars = Math.min(5, Math.max(1, Math.round(score)));
    return Array.from({ length: stars }, (_, i) => (
      <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
    ));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            Help & Documentation
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[60vh]">
          {/* Sidebar */}
          <div className="space-y-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <div className="font-medium mb-2">Categories</div>
              <div className="space-y-1">
                <Button
                  variant={selectedCategory === null ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(null)}
                >
                  All Topics
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.category}
                    variant={selectedCategory === category.category ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSelectedCategory(category.category)}
                  >
                    <span className="capitalize">
                      {category.category.replace("-", " ")}
                    </span>
                    <Badge variant="outline" className="ml-auto">
                      {category.count}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>

            {searchResults.length > 0 && (
              <div>
                <div className="font-medium mb-2">Search Results</div>
                <div className="space-y-2 overflow-y-auto max-h-64">
                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    searchResults.map((result) => (
                      <div
                        key={result.topic.id}
                        className={`p-2 border rounded cursor-pointer transition-colors text-sm ${
                          selectedTopic?.id === result.topic.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                        }`}
                        onClick={() => handleTopicClick(result.topic.id)}
                      >
                        <div className="font-medium">{result.topic.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${categoryColors[result.topic.category]}`}
                          >
                            {result.topic.category.replace("-", " ")}
                          </Badge>
                          <div className="flex">
                            {getRelevanceStars(result.relevanceScore)}
                          </div>
                        </div>
                        {result.matchedContent && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {result.matchedContent}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="md:col-span-2 overflow-y-auto">
            {selectedTopic ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold">{selectedTopic.title}</h1>
                    <Badge className={categoryColors[selectedTopic.category]}>
                      {selectedTopic.category.replace("-", " ")}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <span>Last updated: {new Date(selectedTopic.lastUpdated).toLocaleDateString()}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex gap-1">
                      {selectedTopic.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="prose prose-sm max-w-none">
                  {renderMarkdown(selectedTopic.content)}
                </div>

                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Was this helpful? Let us know how we can improve our documentation.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <Book className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-medium">Welcome to Help</h3>
                  <p className="text-muted-foreground mt-1">
                    Search for topics or browse categories to get started
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory("getting-started");
                      setSearchQuery("");
                    }}
                  >
                    Getting Started
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory("features");
                      setSearchQuery("");
                    }}
                  >
                    Features
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory("troubleshooting");
                      setSearchQuery("");
                    }}
                  >
                    Troubleshooting
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory("examples");
                      setSearchQuery("");
                    }}
                  >
                    Examples
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}