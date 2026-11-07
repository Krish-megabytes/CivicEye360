import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MapPin, Search } from 'lucide-react';
import { api, ApiError } from '../../api';
import { Button, ErrorState, Field, Input, LoadingPanel, PageHeader, Panel, Select, StatusBadge, Textarea } from '../../components/ui/base';
import { useToast } from '../../components/ui/Toast';
import { formatDate, getErrorMessage } from '../../utils/format';
import type { ReportStatus } from '../../types';

const STATUS_NEXT: Partial<Record<ReportStatus, ReportStatus[]>> = {
  Assigned: ['In Progress'], 'In Progress': ['Resolved'], Reopened: ['In Progress', 'Resolved'],
};
export function StaffWorkspacePage() {
  const [search,setSearch]=useState(''); const [status,setStatus]=useState(''); const [notes,setNotes]=useState<Record<string,string>>({}); const [resolutions,setResolutions]=useState<Record<string,string>>({}); const [busy,setBusy]=useState<string|null>(null); const [errors,setErrors]=useState<Record<string,string>>({});
  const queryClient=useQueryClient(); const toast=useToast();
  const query=useQuery({queryKey:['staff-tasks',search,status],queryFn:()=>api.reports.list({q:search||undefined,status:status?[status]:undefined,page:1,pageSize:50,sort:'priority',order:'desc'})});
  async function update(id:string,next:ReportStatus){
    setBusy(id); setErrors(current=>({...current,[id]:''}));
    try{
      if(next==='Resolved'){
        const summary=resolutions[id]?.trim(); if(!summary||summary.length<10){setErrors(current=>({...current,[id]:'A resolution summary of at least 10 characters is required.'}));return;}
        await api.reports.resolve(id,{resolutionSummary:summary,note:notes[id]?.trim()||undefined});
      } else await api.reports.updateStatus(id,{status:next,note:notes[id]?.trim()||undefined});
      toast.success('Task updated',`Report moved to ${next}.`); await queryClient.invalidateQueries({queryKey:['staff-tasks']}); await queryClient.invalidateQueries({queryKey:['reports']});
    }catch(e){setErrors(c=>({...c,[id]:e instanceof ApiError?e.message:getErrorMessage(e)}));}finally{setBusy(null);}
  }
  return <div><PageHeader eyebrow="Field operations" title="My assigned tasks" description="Only reports in your authorized scope are returned by the server. Record work as it happens; completion requires a resolution summary." />
    <Panel className="mb-4 p-3"><div className="grid gap-3 sm:grid-cols-[1fr_200px]"><Field label="Search assigned reports" htmlFor="staff-search"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-ink-faint"/><Input id="staff-search" className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Reference, title or location"/></div></Field><Field label="Status" htmlFor="staff-status"><Select id="staff-status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All active tasks</option>{['Assigned','In Progress','Reopened'].map(s=><option key={s}>{s}</option>)}</Select></Field></div></Panel>
    {query.isLoading?<LoadingPanel rows={5}/>:query.isError?<ErrorState message={getErrorMessage(query.error)} onRetry={()=>void query.refetch()}/>:query.data?.data.length===0?<Panel className="p-6"><h2 className="font-semibold text-ink">No tasks match</h2><p className="mt-1 text-xs text-ink-muted">Assigned tasks will appear here when routed to your account.</p></Panel>:<div className="space-y-3">{query.data?.data.map(report=>{const allowed=STATUS_NEXT[report.status]??[];return <Panel key={report.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={report.status}/><span className="font-mono text-[10px] text-ink-muted">{report.reportId}</span><span className="text-[10px] text-ink-faint">{report.priority}</span></div><Link to={`/reports/${encodeURIComponent(report.reportId)}`} className="mt-2 block text-base font-semibold text-ink hover:text-civic">{report.title}</Link><p className="mt-1 flex items-center gap-1 text-xs text-ink-muted"><MapPin className="size-3.5"/>{report.location.address}</p><p className="mt-1 text-[10px] text-ink-faint">{report.department?.name??'Unassigned department'} · {formatDate(report.createdAt)}</p></div><a className="text-[11px] font-semibold text-civic underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(report.location.address)}`}>Open directions</a></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="Work note (staff-visible)" htmlFor={`note-${report.id}`}><Textarea id={`note-${report.id}`} rows={2} maxLength={2000} value={notes[report.id]??''} onChange={e=>setNotes(c=>({...c,[report.id]:e.target.value}))} placeholder="What work was completed or what remains?"/></Field>{allowed.includes('Resolved')?<Field label="Resolution summary (required)" htmlFor={`resolution-${report.id}`}><Textarea id={`resolution-${report.id}`} rows={2} maxLength={2000} value={resolutions[report.id]??''} onChange={e=>setResolutions(c=>({...c,[report.id]:e.target.value}))} placeholder="Describe the work and outcome for the resident."/></Field>:null}</div>
      {errors[report.id]?<p className="mt-2 text-xs text-danger" role="alert">{errors[report.id]}</p>:null}<div className="mt-3 flex flex-wrap gap-2">{allowed.map(next=><Button key={next} size="sm" loading={busy===report.id} onClick={()=>void update(report.reportId,next)} icon={next==='Resolved'?<CheckCircle2 className="size-3.5"/>:undefined}>{next==='Resolved'?'Record resolution':next==='In Progress'?'Start / resume work':`Move to ${next}`}</Button>)}<Link to={`/reports/${encodeURIComponent(report.reportId)}`} className="inline-flex items-center px-2 text-xs font-semibold text-civic">Open full report</Link></div>
    </Panel>})}</div>}
  </div>;
}
