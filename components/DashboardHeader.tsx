import DataFreshnessBanner from './DataFreshnessBanner';

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  lastRunDate: string | null;
  pipelineStatus: 'ok' | 'no_data' | 'error';
}

export default function DashboardHeader({ title, subtitle, lastRunDate, pipelineStatus }: DashboardHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <DataFreshnessBanner lastRunDate={lastRunDate} status={pipelineStatus} />
      </div>
    </div>
  );
}
