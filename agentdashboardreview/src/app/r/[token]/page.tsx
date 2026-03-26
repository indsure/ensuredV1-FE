import Markdown from 'react-markdown';

export default async function PublicSharePage({ params }: { params: { token: string } }) {
  const { token } = await params;
  
  // NOTE: In production, the API domain should be an environment variable.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  
  const res = await fetch(`${apiUrl}/share/${token}`, { cache: 'no-store' });
  const json = await res.json();
  
  if (!res.ok) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="text-red-500 bg-white p-6 rounded shadow-lg">
          Error: {json.error || "Failed to load report"}
        </div>
      </div>
    );
  }

  const { data } = json;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl bg-white p-8 shadow-lg rounded-xl">
        <h1 className="text-3xl font-bold border-b pb-4 mb-6">IndSure Policy Report</h1>
        <div className="flex gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg flex-1">
            <p className="text-sm text-blue-800 font-semibold mb-1">Score</p>
            <p className="text-2xl font-bold">{data.score}/100</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg flex-1">
            <p className="text-sm text-red-800 font-semibold mb-1">Flaws Identified</p>
            <p className="text-2xl font-bold">{data.flaws_count}</p>
          </div>
        </div>
        
        <div className="prose max-w-none">
          {data.report_markdown ? (
            <Markdown>{data.report_markdown}</Markdown>
          ) : (
            <p className="text-gray-600">{data.summary || "No detailed summary available."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
