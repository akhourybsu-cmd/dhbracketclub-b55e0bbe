import type { AppNotification } from '@/hooks/useNotifications';

export function notificationRow(n: number, user = 'member'): AppNotification {
  return { id: '00000000-0000-4000-8000-' + String(n).padStart(12,'0'), user_id:user,
    club_id:'club', actor_user_id:null, type:'draft_turn', title:'Club update ' + n,
    body:'Your crew has something new to share.', url:null, read_at:null, created_at:'2026-09-10T12:00:00.000Z' };
}

/** In-memory PostgREST subset for isolated tests; never touches a live account. */
export function createNotificationBackend(initial: AppNotification[]) {
  const listeners = new Set<() => void>();
  const state = { rows:initial, failReads:false, failWrites:false, writes:[] as {user:unknown;operation:string}[],
    cursors:[] as string[], beforeWrite:undefined as (()=>void|Promise<void>)|undefined,
    emit:()=>listeners.forEach(fn=>fn()), get subscribers(){return listeners.size;},
    from:(_table:string)=> {
      const filters:((row:AppNotification)=>boolean)[]=[];
      let head=false, limit=Infinity, operation='read', patch:Partial<AppNotification>={}, user:unknown;
      const builder={
        select:(_columns:string, options?:{head?:boolean})=>{head=!!options?.head;return builder;},
        eq:(key:keyof AppNotification,value:unknown)=>{if(key==='user_id')user=value;filters.push(row=>row[key]===value);return builder;},
        is:(key:keyof AppNotification,value:unknown)=>{filters.push(row=>row[key]===value);return builder;},
        lte:(key:keyof AppNotification,value:string)=>{filters.push(row=>Date.parse(String(row[key]))<=Date.parse(value));return builder;},
        order:()=>builder,
        limit:(size:number)=>{limit=size;return builder;},
        abortSignal:(_signal:AbortSignal)=>builder,
        or:(cursor:string)=>{
          state.cursors.push(cursor);
          const match=cursor.match(/^created_at.lt.(.+),and\(created_at.eq.(.+),id.lt.(.+)\)$/);
          if(!match || match[1]!==match[2])throw new Error('Invalid cursor');
          filters.push(row=>row.created_at<match[1] || (row.created_at===match[1]&&row.id<match[3]));return builder;
        },
        update:(values:Partial<AppNotification>)=>{operation='update';patch=values;return builder;},
        delete:()=>{operation='delete';return builder;},
        then:(resolve:(value:unknown)=>unknown,reject?:(error:unknown)=>unknown)=>Promise.resolve().then(async()=>{
          if(operation!=='read')await state.beforeWrite?.();
          if(operation==='read'?state.failReads:state.failWrites)return {data:null,count:null,error:{message:'Fixture request failed'}};
          let rows=state.rows.filter(row=>filters.every(test=>test(row)));
          rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
          if(operation!=='read') {
            state.writes.push({user,operation});
            const ids=new Set(rows.map(row=>row.id));
            state.rows=operation==='delete'?state.rows.filter(row=>!ids.has(row.id)):state.rows.map(row=>ids.has(row.id)?{...row,...patch}:row);
          }
          rows=rows.slice(0,limit);
          return {data:head?null:structuredClone(rows),count:rows.length,error:null};
        }).then(resolve,reject),
      };
      return builder;
    },
    channel:(_name:string)=>{
      let callback:()=>void;
      const channel={on:(_event:string,_filter:unknown,fn:()=>void)=>{callback=fn;return channel;},
        subscribe:()=>{listeners.add(callback);return channel;},close:()=>listeners.delete(callback)};
      return channel;
    },
    removeChannel:(channel:{close:()=>unknown})=>channel.close(),
  };
  return state;
}
