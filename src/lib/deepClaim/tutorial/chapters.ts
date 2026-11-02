import type {TutorialLesson,TutorialLessonId,TutorialOpenAction,TutorialPredicate,TutorialSectionId,TutorialSpeakerId,TutorialStep,TutorialTargetId} from './types';
export const TUTORIAL_SECTION_INFO:Record<TutorialSectionId,{title:string;description:string}>={
 beginner:{title:'The First Descent',description:'Learn the basics with your first short shift.'},
 workforce:{title:'Workforce Management',description:'Choose your people and keep them ready for work.'},
 industry:{title:'Resources & Industry',description:'Store materials, refine them and make better equipment.'},
 field:{title:'Underground Operations',description:'Explore new ground and prepare for deeper work.'},
 business:{title:'Business Development',description:'Choose improvements that help your company grow.'},
 club:{title:'DH Club',description:'Share accomplishments or work on projects together.'},
 settings:{title:'Settings & Game Management',description:'Adjust the game and leave your crew working safely.'},
};
const ui=(type:Parameters<typeof event>[0],detail?:Parameters<typeof event>[1])=>event(type,detail);
function event(type:import('./types').TutorialEventType,detail?:import('./types').TutorialEventDetail):TutorialPredicate{return {kind:'event',type,...(detail?{detail}:{})};}
const fact=(value:Extract<TutorialPredicate,{kind:'snapshot'}>['fact']):TutorialPredicate=>({kind:'snapshot',fact:value});
const ack:TutorialPredicate={kind:'acknowledge'};
const tab=(value:'surface'|'mine'|'crew'|'stores'|'log'|'settings',view?:string):TutorialOpenAction=>({type:'tab',tab:value,...(view?{view}:{})});
const office=(view:'company'|'research'|'contracts'|'records'|'club',club_view?:'projects'|'standings'|'showcase'):TutorialOpenAction=>({type:'office',view,...(club_view?{club_view}:{})});
interface StepDraft{key:string;title:string;instruction:string;target:TutorialTargetId|null;open:TutorialOpenAction|null;predicate:TutorialPredicate;more?:string[];optional_practice?:boolean;fallback_targets?:TutorialTargetId[]}
/** Future controls are reached through these authored, currently available controls. */
const FUTURE_CONTROL_FALLBACKS:Partial<Record<TutorialTargetId,TutorialTargetId[]>>={
 'dispatch-quote':['dispatch-review'],'dispatch-confirm':['dispatch-review'],'jobs-ready':['jobs-active','haul-collect'],
 'sale-review':['stores-stock'],'haul-collect':['jobs-ready'],
 'buildings-list':['building-review'],'map-viewport':['field-operations','dispatch-plan','discovery-review'],
 'production-recipes':['production-recipe','production-review'],'field-finds':['discovery-review'],
 'club-projects':['club-project-review'],'club-showcase':['club-privacy'],
};
function lesson(id:TutorialLessonId,order:number,title:string,objective:string,speaker:TutorialSpeakerId,reference:string[],drafts:StepDraft[],practice?:TutorialPredicate,requires:TutorialLesson['live_requires']='company'):TutorialLesson{
 return {id,version:1,section:id.split('.')[0] as TutorialSectionId,order,title,objective,speaker,summary:reference[0],reference,steps:drafts.map(step=>({...step,id:`${id}.${step.key}`,more:step.more??reference,optional_practice:step.optional_practice??false,...(step.fallback_targets||step.target&&FUTURE_CONTROL_FALLBACKS[step.target]?{fallback_targets:[...(step.fallback_targets??FUTURE_CONTROL_FALLBACKS[step.target!]!)]}:{})})),intro_scene_id:`chapter.${id}`,practice_id:`practice.${id}`,...(practice?{practice_predicate:practice}:{}),live_requires:requires};
}
const step=(key:string,title:string,instruction:string,target:TutorialTargetId|null,open:TutorialOpenAction|null,predicate:TutorialPredicate):StepDraft=>({key,title,instruction,target,open,predicate});
export const TUTORIAL_LESSONS:TutorialLesson[]=[
 lesson('beginner.claim',1,'The Claim',"Give your mining company a name.",'gus',[
  "Your crew, mine and supplies stay saved when you leave.",
  "Choose a name, review the deed, then sign. Continue opens your existing company.",
  "You can replay the guide safely. New Game does not erase your company or create another save.",
 ],[step('deed',"Name your company","Enter a name, then choose Review deed.",'company-name',{type:'found_company'},ack),step('founded',"Sign the deed","Choose Found company to sign the deed.",'company-found',{type:'found_company'},{kind:'company_exists'})],{kind:'company_exists'},undefined),
 lesson('beginner.camp',2,'Welcome to Camp',"Find your buildings and the mine.",'gus',[
  "Surface is your camp. Mine shows the tunnels below it.",
  "The Mine Office manages crews, the shaft provides access, the Warehouse stores materials, and the Tool Station makes equipment.",
  "Open a building to inspect it. Only confirming a build or upgrade spends credits.",
 ],[step('surface',"Look around camp","Open Surface to see your camp.",'nav-surface',tab('surface'),ui('tab_opened',{tab:'surface'})),step('building',"Open a building","Choose a building to see its upgrade and price.",'buildings-list',tab('surface','buildings'),ui('building_inspected')),step('mine',"Find the mine","Open Mine to look underground.",'nav-mine',tab('mine'),ui('tab_opened',{tab:'mine'}))]),
 lesson('beginner.crew',3,"Meet the Crew","Meet Mara, Ivo and Tessa.",'mara',[
  "Mara mines, Ivo studies the rock, and Tessa handles hauling.",
  "Skills affect the crew’s work. Traits add strengths and drawbacks to consider before dispatch.",
  "Each worker gets six energy daily. Send one to three available workers; dispatch pays their energy and wages.",
 ],[step('crew',"Open Crew","Open Crew to see your workers.",'nav-crew',tab('crew'),ui('tab_opened',{tab:'crew'})),step('mara',"Mara: Mining","Tap Mining in Mara Flint’s crew file.",'worker-stat-mining',{type:'worker',name:'Mara Flint'},ui('stat_inspected',{worker_name:'Mara Flint',stat:'mining'})),step('ivo',"Ivo: Geology","Tap Geology in Ivo Vale’s crew file.",'worker-stat-geology',{type:'worker',name:'Ivo Vale'},ui('stat_inspected',{worker_name:'Ivo Vale',stat:'geology'})),step('tessa',"Tessa: Logistics","Tap Logistics in Tessa Pike’s crew file.",'worker-stat-logistics',{type:'worker',name:'Tessa Pike'},ui('stat_inspected',{worker_name:'Tessa Pike',stat:'logistics'})),step('conditions',"Check their energy","Check your workers’ energy and wages.",'worker-energy',tab('crew'),ack)]),
 lesson('beginner.mine',4,'Beneath the Surface',"Look around your mine and choose a site.",'ivo',[
  "Dark areas are unexplored. Your crew reveals them as it works.",
  "Tunnels stay open and deposits run out. Crews need connected routes and enough supported depth.",
  "Drag or use the map buttons to move around. The worksite list also lets you choose a site.",
 ],[step('enter',"Open Mine","Open Mine to see your tunnels.",'nav-mine',tab('mine'),ui('tab_opened',{tab:'mine'})),step('control',"Move the view","Use a map button to zoom or focus.",'map-controls',tab('mine'),ui('map_interacted')),step('inspect',"Choose a site","Choose a revealed site or use the worksite list.",'map-viewport',tab('mine'),ui('worksite_inspected'))]),
 lesson('beginner.worksite',5,"Choose a Worksite","Choose where your crew will work.",'mara',[
  "Explore opens new ground. Extract mines a deposit you already know.",
  "The shallow starter coal seam offers one 30-second first shift per company.",
  "If you have used it, choose another site or review the example without spending.",
 ],[step('difference',"Explore or Extract?","Extract works a known deposit; Explore opens new ground. Keep First shift selected.",'dispatch-mode',{type:'dispatch',mode:'extract'},ack),step('planner',"Open the shift plan","Open the planner for an available worksite.",'dispatch-plan',{type:'dispatch',mode:'extract'},ui('dispatch_opened'))]),
 lesson('beginner.plan',6,"Plan Your First Shift","Choose a crew and check the shift cost.",'tessa',[
  "Select workers with enough energy. The 30-second first shift takes one energy each.",
  "Quick takes 20 minutes and one energy per worker; Standard takes 60 minutes and two energy, and Deep takes 180 minutes and three energy.",
  "Review dispatch shows wages, travel, cargo space and risk before payment. A blocked plan explains what needs changing.",
 ],[step('selection',"Choose your crew","Select workers with enough energy for the shift.",'dispatch-crew',{type:'dispatch'},ui('crew_selected')),step('quote',"Review the plan","Tap Review dispatch to check the cost.",'dispatch-quote',{type:'dispatch'},ui('quote_reviewed'))]),
 lesson('beginner.descent',7,'The First Descent',"Send your crew on its first shift.",'gus',[
  "Dispatch crew starts the shift and pays the displayed wages and energy.",
  "The crew travels, prepares, works, hauls its materials and returns.",
  "If the connection fails, choose Confirm sync to check the saved action instead of dispatching again.",
 ],[step('confirmed',"Dispatch your crew","Check the cost, then tap Dispatch crew.",'dispatch-confirm',{type:'dispatch'},fact('expedition_exists'))],fact('expedition_exists')),
 lesson('beginner.waiting',8,"While They Work","Follow the crew until its haul returns.",'ivo',[
  "Your crew keeps working when you close the game. You can look around while you wait.",
  "At the timer’s end, the game checks the return. Refresh if its report has not arrived.",
  "Returned cargo waits outside the Warehouse. Collect it before selling or using the materials.",
 ],[step('stages',"Find the working crew","Open Surface to see the shift’s progress.",'jobs-active',tab('surface'),fact('expedition_exists')),step('returned',"Wait for the haul","Let the first shift finish. You can look around meanwhile.",'jobs-ready',tab('surface'),fact('return_ready'))],fact('return_ready')),
 lesson('beginner.haul',9,"Collect Your Haul","Move the returned haul into storage.",'tessa',[
  "Open haul shows what the crew brought home. Collect into storage puts it in the Warehouse.",
  "Collect what fits. Remaining cargo stays safe while you sell, use materials or upgrade storage.",
  "Exploration sometimes returns without ore. You can review the example if there is nothing to collect.",
 ],[step('cargo',"Open the haul","Tap Open haul on the returned shift.",'jobs-ready',tab('surface','returns'),fact('return_ready')),step('collected',"Put it in storage","Tap Collect into storage to put the haul away.",'haul-collect',tab('surface','returns'),fact('cargo_collected'))],fact('cargo_collected')),
 lesson('beginner.sale',10,"Sell or Save","Learn how to sell a little of your stock.",'tessa',[
  "Sell your stock, process it, make equipment or save it for later.",
  "Choose a quantity and check the total before Confirm sale. You can sell just part of a haul.",
  "You can keep everything. Choose Keep materials in the guide to move on without selling.",
 ],[step('stock',"Open your inventory","Open Stores and look at your Stock.",'stores-stock',tab('stores','stock'),ui('stock_inspected')),step('sale',"Choose what to sell","Sell a little coal, or choose Keep materials.",'sale-review',tab('stores','stock'),fact('sale_confirmed'))],fact('sale_confirmed')),
 lesson('beginner.upgrade',11,"Your First Upgrade","Compare your first building upgrade.",'gus',[
  "Buildings add crews, deeper access, storage or better tools.",
  "Check the benefit and price before buying. Keep two credits for wages.",
  "Reviewing an upgrade finishes this lesson. An optional purchase earns a separate practice mark.",
 ],[step('review',"Review an upgrade","Open a building to compare its upgrade and price. Buying is optional.",'building-review',tab('surface'),ui('building_inspected'))],fact('upgrade_confirmed')),
 lesson('beginner.graduate',12,"Ready to Run Your Claim","Choose your next shift.",'gus',[
  "Choose a site, send a crew, collect the haul and decide what to do with it.",
  "Ordinary shifts continue while you are away. Return when the crew is ready, then plan your next investment.",
  "Use the rest of the guide when you need it. Lessons record learning; they do not add money or materials.",
 ],[step('ready',"You’re ready","Choose your next shift. The guide is here whenever you need it.",'training-journal',{type:'journal'},ack)]),
 lesson('workforce.hiring',1,'Hiring Employees',"Compare a candidate’s skills, wages and hiring cost.",'gus',[
  "The Hiring Office offers daily candidates across seven specialties. Confirming a hire pays the price and adds that worker.",
  "Starting housing holds three employees. Workers’ Quarters adds room; new workers still need energy, wages and an available crew slot.",
  "Inspecting candidates costs nothing. You can use an example before expanding.",
 ],[step('office',"Find candidates","Open Crew, then Hire.",'hire-office',tab('crew','hire'),ui('tab_opened',{tab:'crew'})),step('capacity',"Check the room","Check your housing and the next Workers’ Quarters upgrade.",'hire-office',tab('crew','hire'),ack)],fact('has_hire'),'schema2'),
 lesson('workforce.stats',2,'Employee Statistics',"See how each worker’s skills help the crew.",'mara',[
  "Mining helps recovery, Geology helps exploration, and Engineering improves setup, structures and deep heat protection.",
  "Logistics helps travel and cargo; Safety reduces disruption; Endurance supports longer shifts; Leadership improves teamwork.",
  "Displayed skills include training, experience, working equipment and completed research. Each is capped at 100.",
 ],[step('file',"Open a crew file","Choose Crew file on a worker.",'worker-stats',tab('crew'),ui('worker_inspected')),step('meaning',"Choose a skill","Tap a skill to see how it helps.",'worker-stats',tab('crew'),ui('stat_inspected'))],undefined,'schema2'),
 lesson('workforce.training',3,'Training',"Choose a skill to improve with training.",'mara',[
  "A 30-credit course improves one base skill by up to three points, capped at 100.",
  "Workers must be idle and can train once per company day. Training does not restore energy.",
  "Check the improvement and price before confirming. Reviewing a course does not buy it.",
 ],[step('course',"Open Training","Open a worker’s Training tab and choose a skill.",'worker-training',{type:'worker',view:'training'},ui('worker_inspected',{view:'training'})),step('limits',"Check the course","Check the gain, cost and daily limit.",'worker-training',tab('crew'),ack)],fact('has_training'),'schema2'),
 lesson('workforce.equipment',4,'Equipment',"Choose equipment for a worker’s three slots.",'mara',[
  "Workers have tool, head and utility slots. Each item can belong to one worker at a time.",
  "Gear helps mining, hauling, surveying or heat protection. Working bonuses are already included in displayed skills.",
  "Nickel Heat Shields must be assigned and working. Protection averages the shields worn by the selected crew.",
 ],[step('slots',"Open Gear","Open a worker’s Gear tab.",'worker-gear',{type:'worker',view:'gear'},ui('worker_inspected',{view:'gear'})),step('tradeoff',"Inspect an item","Open an item to check its bonuses, condition and slot.",'worker-gear',tab('crew'),ack)],fact('has_equipment'),'schema2'),
 lesson('workforce.repairs',5,'Durability and Repairs',"Check when equipment needs repairing or retiring.",'tessa',[
  "Returning shifts wear equipment down. Broken items stop helping future work; running shifts keep their starting equipment.",
  "Repair restores condition for the listed credits and materials. Affected workers must be idle.",
  "Owned and unfinished equipment share a 48-item limit. Permanently retiring unassigned gear frees space without a refund.",
 ],[step('condition',"Check the condition","Open Gear and check an owned item’s condition.",'worker-gear',{type:'worker',view:'gear'},ui('worker_inspected',{view:'gear'})),step('repair',"Review the repair","Compare repairing, keeping or retiring the item before confirming.",'worker-gear',tab('crew'),ack)],fact('has_repair'),'schema2'),
 lesson('industry.ore',1,'Understanding Ore',"Find out what your materials are useful for.",'ivo',[
  "Stone, clay, coal, copper, tin, iron, quartz, silver, amethyst and gold all have useful roles.",
  "The Ancient Deep adds nickel ore and sulfur. The Smeltery makes nickel alloy.",
  "Coal remains useful fuel. Check recipes, equipment, research and club projects before selling supplies.",
 ],[step('catalog',"Inspect a material","Tap a material’s picture in Stock.",'stores-resource',tab('stores','stock'),ui('stock_inspected')),step('uses',"Find a recipe","Open Workshop and review a recipe that uses it.",'production-recipes',tab('stores','workshop'),ui('recipe_inspected'))],undefined,'company'),
 lesson('industry.warehouse',2,'Warehouse Management',"Manage stored materials and cargo waiting outside.",'tessa',[
  "The Warehouse holds collected materials. Hauls and finished batches wait safely outside when it is full.",
  "Collect stock before selling, processing, delivering or contributing it.",
  "Collect what fits and make room for the rest. Cargo left outside is kept safely.",
 ],[step('capacity',"Check your storage","Open Stock to check your free Warehouse space.",'stores-capacity',tab('stores','stock'),ui('stock_inspected')),step('staging',"Find waiting cargo","Open Workshop to find finished orders waiting for collection.",'production-queue',tab('stores','workshop'),ack)],fact('cargo_collected')),
 lesson('industry.smeltery',3,'The Smeltery',"Turn ore and coal into metal bars.",'mara',[
  "The Smeltery uses ore, coal, a fee and processing time to make metal bars.",
  "Bronze, steel and gold need research. One nickel alloy uses three nickel ore, one iron bar, two coal and 10 credits.",
  "Nickel alloy also needs Smeltery level three, Processing 2 and Deep Operations 2. Check these requirements before planning a batch.",
 ],[step('station',"Choose a metal recipe","Choose Smeltery in Workshop, then Review recipe.",'production-recipes',{type:'tab',tab:'stores',view:'workshop',station:'smeltery'},ui('recipe_inspected',{view:'smeltery'})),step('inputs',"Check the batch","Check the inputs, fee, time and output.",'production-review',{type:'tab',tab:'stores',view:'workshop',station:'smeltery'},ack)],{kind:'production',station:'smeltery',state:'started'},'schema2'),
 lesson('industry.gems',4,'Gem Workshop',"Polish quartz and cut amethyst.",'ivo',[
  "The Gem Workshop polishes quartz and cuts amethyst for the listed materials, fee and time.",
  "Finished crystals are separate items used in equipment, research and delivery orders.",
  "Check the recipe and station level. Quartz and amethyst are the current gem-finishing options.",
 ],[step('gems',"Choose a gem recipe","Choose Gem Workshop, then review a crystal recipe.",'production-recipes',{type:'tab',tab:'stores',view:'workshop',station:'gem_workshop'},ui('recipe_inspected',{view:'gem_workshop'})),step('finish',"Check the output","Check the output and how to collect it.",'production-review',{type:'tab',tab:'stores',view:'workshop',station:'gem_workshop'},ack)],{kind:'production',station:'gem_workshop',state:'collected'},'schema2'),
 lesson('industry.crafting',5,'The Tool Station',"Make equipment and assign it to your crew.",'mara',[
  "The Tool Station makes equipment from stored materials and credits. Collect the finished order before equipping it.",
  "Advanced gear needs upgrades and research. A Nickel Heat Shield costs two nickel alloy, two polished quartz, two sulfur and 80 credits.",
  "Equip collected gear through an idle worker’s Gear tab. Crafting does not assign it automatically.",
 ],[step('craft',"Choose equipment to make","Choose Tool Station, then review an equipment recipe.",'production-recipes',{type:'tab',tab:'stores',view:'workshop',station:'tool_station'},ui('recipe_inspected',{view:'tool_station'})),step('assign',"Plan who will use it","Open a worker’s Gear tab to plan the assignment.",'worker-gear',{type:'worker',view:'gear'},ui('worker_inspected',{view:'gear'}))],{kind:'production',station:'tool_station',state:'collected',equipment_output:true},'schema2'),
 lesson('industry.queues',6,'Production Queues',"Read working, queued and finished orders.",'tessa',[
  "Each station works on one order at a time. Later orders queue there while other stations work independently.",
  "Orders have one to ten batches, with three uncollected orders company-wide. Owned and unfinished equipment share a 48-item limit.",
  "Upgrades and Processing research speed up future orders. Started orders keep their ingredients, price and timing.",
 ],[step('queue',"Check the queue","Open Workshop to check each order’s progress.",'production-queue',tab('stores','workshop'),ui('production_inspected')),step('limits',"Review a batch","Open a recipe to check its batch and queue limits.",'production-review',tab('stores','workshop'),ack)],fact('production_collected'),'schema2'),
 lesson('field.exploration',1,'Geological Exploration',"Open a route into new ground.",'ivo',[
  "Explore opens new ground as the crew works outward from connected tunnels.",
  "Revealed caves become passages when connected. Finding open air does not guarantee ore or stone.",
  "Existing ground stays unchanged. New nickel and sulfur seams can appear in new areas below 608m.",
 ],[step('frontier',"Open Explore","Choose Explore to inspect a worksite and route.",'dispatch-mode',{type:'dispatch',mode:'explore'},ui('dispatch_opened',{mode:'explore'})),step('finite',"Check the ground","Compare known deposits with unexplored ground.",'field-operations',tab('mine'),ack)],event('expedition_confirmed',{mode:'explore'})),
 lesson('field.survey',2,'Surveying',"Learn about the ground without mining it.",'ivo',[
  "Survey reveals ground around a connected, excavated passage. Its preset, Geology and Ore Eye affect coverage.",
  "Surveys cost wages and energy but return no ore. Check the radius and tile limit before dispatch.",
  "The report arrives when the crew returns. There is no empty haul to collect.",
 ],[step('survey',"Choose Survey","Open Survey at a connected, excavated passage.",'dispatch-mode',{type:'dispatch',mode:'survey'},ui('dispatch_opened',{mode:'survey'})),step('quote',"Review the survey","Tap Review dispatch to check coverage and cost.",'dispatch-quote',{type:'dispatch',mode:'survey'},ui('quote_reviewed'))],fact('survey_completed'),'schema3'),
 lesson('field.infrastructure',3,'Underground Infrastructure',"Prepare the mine with lasting improvements.",'mara',[
  "Supports help unstable rock, ventilation helps gas and heat, pumps help water, and rail speeds up covered routes.",
  "Building needs a connected, excavated site, crew, materials and fee. Presets set the grade; Engineering improves coverage and strength.",
  "Only finished installations help. The strongest covering protection applies, and rail improves only the route it covers.",
 ],[step('project',"Choose a project","Choose an Infrastructure project for a connected passage.",'field-infrastructure',{type:'dispatch',mode:'infrastructure'},ui('dispatch_opened',{mode:'infrastructure'})),step('cost',"Review the installation","Tap Review dispatch to check materials, fee and coverage.",'dispatch-quote',{type:'dispatch',mode:'infrastructure'},ui('quote_reviewed'))],fact('infrastructure_installed'),'schema3'),
 lesson('field.hazards',4,'Operational Hazards',"Prepare for delays and heat before going deeper.",'gus',[
  "Rockfall, gas and water can delay setup. These incidents do not kill workers, destroy cargo or take extra energy.",
  "At 600–999m, heat reduces how much mining or exploration a shift can do. Engineering, ventilation and working heat shields reduce that loss.",
  "Shaft six costs 24,000 credits and requires Deep Operations 2. Its lift saves travel on the built central shaft through 956m; side tunnels still take time.",
 ],[step('conditions',"Check the conditions","Check the plan’s risk, protection, heat and lift effects.",'dispatch-conditions',{type:'dispatch'},ui('quote_reviewed')),step('safety',"Compare the effects","Compare setup delays with the heat penalty on useful work.",'dispatch-conditions',{type:'dispatch'},ack)],undefined,'schema3'),
 lesson('field.reports',5,'Expedition Reports',"See what happened during a shift.",'ivo',[
  "Reports describe work your crew has completed or incidents it has encountered.",
  "Incidents appear after setup. Survey and construction reports arrive on return. Estimates are not completed reports.",
  "The log shows recent activity. Older work still counts toward lifetime company records.",
 ],[step('log',"Open Reports","Open Log, then Reports.",'field-log',tab('log','reports'),ui('tab_opened',{tab:'log'})),step('report',"Read a report","Open a report to see what happened.",'field-reports',tab('log','reports'),ack)],undefined,'schema3'),
 lesson('field.discoveries',6,'Rare Discoveries',"Decide what to do with a rare find.",'ivo',[
  "Finishing a deposit may uncover a geode, fossil, journal, rail relic, crystal cluster or meteorite fragment, brought home after the shift.",
  "Finds can be common, fine, exceptional or flawless. Surveying reveals ground but does not collect specimens.",
  "Keep saves it, Sell pays its listed value, and Salvage exchanges it for materials if everything fits. These choices are permanent.",
 ],[step('finds',"Open your finds","Open Log, then Finds.",'field-finds',tab('log','finds'),ui('tab_opened',{tab:'log'})),step('choice',"Compare your options","Inspect a specimen before choosing Keep, Sell or Salvage.",'discovery-review',tab('log','finds'),ack)],fact('discovery_decided'),'schema3'),
 lesson('business.office',1,'The Company Office',"Find the right part of the Company Office.",'gus',[
  "The Company Office brings finances, research, contracts and records together.",
  "Company shows the overview. Research unlocks improvements, Contracts pay for materials, and Records tracks milestones.",
  "Club activities are optional. Choose separately whether to share standings or a specimen showcase.",
 ],[step('office',"Open the Office","Open Company Office from Surface.",'office-company',office('company'),ui('tab_opened',{view:'company'})),step('sections',"Choose a section","Choose the section for your next decision.",'office-company',office('company'),ack)],undefined,'schema4'),
 lesson('business.research',2,'Research',"Choose a permanent company improvement.",'gus',[
  "Seven research branches offer two improvements each. Check requirements, materials, price and time.",
  "One project runs at a time. Its completion report applies bonuses to future work, not jobs already started.",
  "Processing can cut future production time by 15%. Deep Operations 2 enables shaft six and nickel industry, which still need upgrades and supplies.",
 ],[step('tree',"Choose a research project","Choose a Research branch, then View research.",'office-research',office('research'),ui('research_inspected')),step('cost',"Check the requirements","Check the benefit, price, materials and prerequisites.",'research-review',office('research'),ack)],fact('research_completed'),'schema4'),
 lesson('business.contracts',3,'Trading Contracts',"Deliver a complete order for company credits.",'tessa',[
  "The Trading Post has twelve one-time orders. Requirements apply, but orders do not expire or change daily.",
  "Deliver all listed collected materials together for the shown credits. Cargo outside the Warehouse cannot fulfill an order.",
  "Review first, then confirm. Inspection spends nothing, and completed orders cannot pay twice.",
 ],[step('orders',"Review an order","Open Contracts, then Review order.",'office-contracts',office('contracts'),ui('contract_inspected')),step('whole',"Check what is missing","Check missing materials before Deliver whole order.",'contract-review',office('contracts'),ack)],fact('contract_completed'),'schema4'),
 lesson('business.milestones',4,'Milestones and Records',"Claim rewards for company milestones.",'gus',[
  "Eight milestones reward completed shifts, collected production, research and deliveries.",
  "Ready means the goal is met. Claim its credits once; Claimed means the reward is already collected.",
  "Company milestones are separate from DH Feats. Reading the guide awards neither credits nor DH Score.",
 ],[step('records',"Open a milestone","Open Records and choose a milestone.",'office-records',office('records'),ui('milestone_inspected')),step('claim',"Check its status","Check whether the reward is Ready or already Claimed.",'milestone-review',office('records'),ack)],fact('milestone_claimed'),'schema4'),
 lesson('business.strategy',5,'Business Strategy',"Choose the investment your company needs next.",'gus',[
  "Hiring adds rested workers. Building upgrades can add crews, storage, depth or workshop options.",
  "Selling gives credits now. Processing uses materials and time; research buys lasting benefits with current supplies.",
  "Deeper work also needs access and a prepared crew. Compare investments; the next deposit is never guaranteed.",
 ],[step('overview',"Check the company","Check your funds, available crew and ongoing work.",'office-company',office('company'),ui('tab_opened',{view:'company'})),step('tradeoff',"Compare two options","Compare two uses for the same credits or materials.",'office-company',office('company'),ack)],undefined,'schema4'),
 lesson('club.projects',1,'Club Projects',"Decide whether to contribute to a club project.",'tessa',[
  "Six club projects accept stored materials. Each material has a personal limit based on the project’s starting club size.",
  "Contributions are permanent and cannot be traded back. Invalid contributions spend nothing; keep enough supplies and credits for your own operation.",
  "A current eligible member who contributes at least 5% of a completed project’s value can claim a rounded-down share of its credit pool once. Limits may rise if the club shrinks.",
 ],[step('project',"Open a club project","Open Club, then Projects, and choose a project.",'club-projects',office('club','projects'),ui('club_view_opened',{view:'projects'})),step('review',"Check your contribution","Check the materials and your limit. Contributions are permanent.",'club-project-review',office('club','projects'),ack)],event('club_contribution_confirmed'),'club'),
 lesson('club.standings',2,'Standings',"Compare the club’s three mining records.",'gus',[
  "Weekly Mining Value counts returned haul during the club’s Monday-to-Monday week. Selling that stock does not reduce it.",
  "Operational Depth tracks the deepest completed mining or exploration shift. Best Find tracks the most valuable recovered specimen.",
  "Boards are separate, allow ties and are optional. Another company’s latest work appears after it checks in.",
 ],[step('board',"Read a standings board","Open Standings and choose a record to compare.",'club-standings',office('club','standings'),ui('club_view_opened',{view:'standings'})),step('meaning',"Check sharing","Check what is shared before joining the board.",'club-standings',office('club','standings'),ack)],undefined,'club'),
 lesson('club.showcase',3,'Company Showcases',"Choose which kept specimens to show the club.",'ivo',[
  "A showcase starts private. Choose up to three kept specimens to display with your name and company.",
  "It does not share your map, crew, cash, stock or specimen locations.",
  "Older featured finds can stay displayed beyond your recent list. You choose and publish them; the guide never changes your collection.",
 ],[step('case',"Open Showcase","Open Club, then Showcase.",'club-showcase',office('club','showcase'),ui('club_view_opened',{view:'showcase'})),step('curate',"Review what to share","Check your chosen specimens before turning sharing on.",'club-privacy',office('club','showcase'),ack)],event('preferences_confirmed',{view:'showcase_published'}),'club'),
 lesson('club.privacy',4,'Privacy',"Choose what, if anything, to share with the club.",'gus',[
  "Standings and showcase sharing start off and are independent. Browsing or contributing turns neither on.",
  "Turning sharing off hides future views without deleting your company, rewards or past contributions.",
  "Shared activities are for current eligible members. The guide and examples never change privacy settings.",
 ],[step('consent',"Check both switches","Read both sharing options.",'club-privacy',office('club','showcase'),ui('privacy_reviewed')),step('choice',"Choose your privacy","Keep sharing off or change it yourself. Either is fine.",'club-privacy',office('club','showcase'),ack)],undefined,'club'),
 lesson('club.updates',5,'DH Achievements and Updates',"Find your DH Feats and notification settings.",'gus',[
  "Mining accomplishments can earn DH Feats. Lessons and clicks do not add DH Score.",
  "Company credits, DH Score and club-project reward pools are separate.",
  "Deep Claim updates appear in the shared inbox when the company checks in. Your notification preference controls them.",
 ],[step('updates',"Open Updates","Open Settings, then Updates.",'settings-updates',tab('settings','updates'),ui('settings_opened',{view:'updates'})),step('score',"Find your Feats","Open Feats to review your earned awards.",'settings-updates',office('company'),ack)],undefined,'company'),
 lesson('settings.sound',1,'Sound and Visual Settings',"Set the sound and visuals to suit you.",'tessa',[
  "Sound starts off. Turn it on and adjust music, mining effects and ambience; app-wide mutes still apply.",
  "Reduced motion and Reduced graphics are separate comfort settings. Neither changes what your crew earns.",
  "Sound and animation pause when the game is hidden or closed. Your crew keeps working.",
 ],[step('settings',"Open Settings","Open Settings to see your options.",'settings-sound',tab('settings'),ui('settings_opened')),step('comfort',"Check Visuals","Open Visuals to check reduced motion and graphics.",'settings-visuals',tab('settings','visuals'),ack)]),
 lesson('settings.main_menu',2,'Returning to the Main Menu',"Return to the title without losing your company.",'gus',[
  "Return to Main Menu opens the title while keeping your company, supplies and work.",
  "Continue reopens this club’s company without starting a new save.",
  "If you see a saved report, reconnect and refresh before buying anything or starting work.",
 ],[step('menu',"Return to the title","Choose Return to Main Menu, then look for Continue.",'settings-main-menu',tab('settings','sound'),ui('main_menu_opened'))]),
 lesson('settings.exit',3,'Leaving the Game',"Leave the game while your crews keep working.",'tessa',[
  "Return to DH Club opens Compete. Paid shifts and production keep running.",
  "On return, the game checks completed work before new company decisions.",
  "Use Confirm sync for an uncertain action instead of starting again. Closing the guide does not repeat or confirm purchases.",
 ],[step('exit',"Find the way back","Find Return to DH Club. You can stay here for this review.",'game-exit',{type:'return_to_club'},ack)]),
];
export const BEGINNER_LESSONS=TUTORIAL_LESSONS.filter(lesson=>lesson.section==='beginner');
export const ACADEMY_LESSONS=TUTORIAL_LESSONS.filter(lesson=>lesson.section!=='beginner');
export const TUTORIAL_LESSON_BY_ID=Object.fromEntries(TUTORIAL_LESSONS.map(lesson=>[lesson.id,lesson])) as Record<TutorialLessonId,TutorialLesson>;
export const TUTORIAL_STEP_IDS=TUTORIAL_LESSONS.flatMap(lesson=>lesson.steps.map(step=>step.id));
export function getTutorialLesson(id:string):TutorialLesson|null{return TUTORIAL_LESSON_BY_ID[id as TutorialLessonId]??null;}
export function getTutorialStep(id:string):TutorialStep|null{return TUTORIAL_LESSONS.flatMap(lesson=>lesson.steps).find(step=>step.id===id)??null;}
