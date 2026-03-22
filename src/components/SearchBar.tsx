import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  onSearch: (word: string) => void;
  isLoading: boolean;
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim().toLowerCase());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-lg mx-auto">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setQuery("")}
        placeholder="영어 단어를 입력하세요..."
        className="font-body text-base h-12 rounded-lg"
        autoFocus
      />
      <Button
        type="submit"
        disabled={isLoading || !query.trim()}
        className="h-12 px-5 rounded-lg bg-primary text-primary-foreground font-display font-semibold"
      >
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
      </Button>
    </form>
  );
}
