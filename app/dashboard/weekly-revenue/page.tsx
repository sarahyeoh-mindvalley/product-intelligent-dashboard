export default function WeeklyRevenuePage() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-400">Journey</span>
          <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-xs text-green-600 font-medium">Weekly Revenue Reporting</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Weekly Revenue Reporting</h1>
      </div>
      <iframe
        src="https://weekly-revenue-reporting-e38f-jdtcvngavq-as.a.run.app/"
        className="flex-1 w-full border-0"
        allowFullScreen
      />
    </div>
  );
}
