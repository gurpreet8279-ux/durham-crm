import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Send, Loader2, FileText, Crown } from 'lucide-react';

export default function AIParser() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleProcess = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/process-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect to the server');
      }
      
      setOutput(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Left Column: Input */}
      <section className="flex flex-col h-[calc(100vh-8rem)] min-h-[500px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-blue-500" />
            Raw Log Input
          </h2>
        </div>
        
        <textarea
          className="flex-1 w-full bg-white border border-slate-200 rounded-xl p-5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-mono placeholder:text-slate-400 shadow-sm"
          placeholder="Paste your messy, unformatted, or OCR-scraped text data here...&#10;&#10;E.g.,&#10;July 14 Jon Doe 5551234567 Chevy Trail 150 Oshawa 123 Main St..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">Ensure data is pasted before parsing.</p>
          <button
            onClick={handleProcess}
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {loading ? 'Processing...' : 'Parse Data'}
          </button>
        </div>
      </section>

      {/* Right Column: Output */}
      <section className="flex flex-col h-[calc(100vh-8rem)] min-h-[500px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <FileText size={16} className="text-blue-500" />
            Structured Output
          </h2>
        </div>
        
        <div className="flex-1 w-full bg-white border border-slate-200 rounded-xl p-6 overflow-y-auto shadow-sm relative">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm mb-4">
              <strong>Error: </strong> {error}
            </div>
          )}
          
          {!output && !error && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <Crown size={48} className="opacity-20" />
              <p className="text-sm max-w-sm text-center font-medium">
                Your structured Markdown table and generated follow-up messages will appear here.
              </p>
            </div>
          )}

          {loading && (
            <div className="h-full flex flex-col items-center justify-center text-blue-500 space-y-4">
              <Loader2 size={40} className="animate-spin" />
              <p className="text-sm text-slate-500 font-medium animate-pulse">Running AI pipeline...</p>
            </div>
          )}

          {output && !loading && (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {output}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
