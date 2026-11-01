// Deterministic, offline v1 economy guardrails. No production accounts, writes or hidden geography.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const built = await build({ stdin: { contents: `export * from './src/lib/deepClaim/types.ts'; export * from './src/lib/deepClaim/catalog.ts'; export * from './src/lib/deepClaim/simulation.ts'; export * from './src/lib/deepClaim/production.ts'; export * from './src/lib/deepClaim/field.ts'; export * from './src/lib/deepClaim/business.ts';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const engine = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const { STARTER_WORKERS, RESOURCE_CATALOG, DEEP_CLAIM_MINERAL_IDS, RECIPE_CATALOG, EQUIPMENT_CATALOG, productionQuote, recipeValueAdded, availableEquipmentCapacity, calculateCrewPlan, withdrawFinite, collectCargo, sellResource, retainsOperatingCapital, canUpgrade, BUILDING_UPGRADE_COSTS } = engine;
const workers = STARTER_WORKERS.map((worker,index) => ({ ...worker, id: `benchmark-${index}`, traits: [...worker.traits], stats: { ...worker.stats }, xp: 0, level: 1, energy: 6, assigned_job_id: null }));
const crews = [[workers[0]],[workers[1]],[workers[2]],[workers[0],workers[1]],[workers[0],workers[2]],[workers[1],workers[2]],workers];
let scenarios = 0;
for (const crew of crews) for (const duration_minutes of [20,60,180]) for (const resource of RESOURCE_CATALOG.filter(resource=>DEEP_CLAIM_MINERAL_IDS.includes(resource.id))) {
  const plan = calculateCrewPlan({ workers: crew, mode: 'extract', duration_minutes, path_edges: 20, target_depth: 20, tool_level: 1, material: resource.id, remaining: 150 });
  assert(plan.feasible_work_time); assert(plan.quantity >= 1); assert(plan.quantity <= 150); assert(plan.quantity <= plan.capacity);
  assert(plan.estimated_yield.max <= Math.min(150,plan.capacity));
  assert.equal(plan.stages.reduce((sum,stage) => sum + stage.duration_seconds,0), duration_minutes*60);
  assert(plan.wages > 0); assert(plan.energy_per_worker >= 1 && plan.energy_per_worker <= 3);
  scenarios++;
}
const tutorial = calculateCrewPlan({ workers:[workers[0]],mode:'extract',duration_minutes:20,path_edges:2,target_depth:1,tool_level:1,material:'coal',remaining:100,tutorial:true });
let cash = 180-tutorial.wages;
const starter = collectCargo({}, { coal:10,stone:12 }, 120);
assert(starter.complete);
let starterInventory = starter.inventory;
for (const [resource,quantity] of Object.entries(starterInventory)) { const sold = sellResource(starterInventory,cash,resource,quantity); cash = sold.cash; starterInventory = sold.inventory; }
assert.equal(Object.values(starterInventory).reduce((sum,quantity)=>sum+quantity,0),0);
assert.equal(cash,229);
assert(canUpgrade(cash,'tool_station',1)); assert(canUpgrade(cash,'mine_office',1));
const allUpgradeCost = ['mine_office','mine_shaft','warehouse','tool_station'].flatMap(key=>BUILDING_UPGRADE_COSTS[key].slice(0,2)).reduce((sum,cost)=>sum+cost,0);
const phase4UpgradeCost=Object.values(BUILDING_UPGRADE_COSTS).flat().reduce((sum,cost)=>sum+cost,0);
const phase3UpgradeCost=Object.entries(BUILDING_UPGRADE_COSTS).filter(([key])=>!['research_office','trading_post'].includes(key)).flatMap(([,costs])=>costs).reduce((sum,cost)=>sum+cost,0);
const phase2UpgradeCost=phase3UpgradeCost-12000;
const starterAssay = {stone:12,clay:16,coal:10,copper_ore:18,tin_ore:12,iron_ore:15,quartz:8,silver_ore:3};
const assayValue = engine.resourceSaleValue(starterAssay);
assert.equal(allUpgradeCost,6080); assert.equal(assayValue,744);
assert(180+assayValue<allUpgradeCost,'Finite initial assay alone must not fund complete company upgrades, even after24hours.');
assert(allUpgradeCost > cash, 'Tutorial must not pay for every company upgrade.');
assert.equal(retainsOperatingCapital(2,2,{}, { stone:1 }),false,'One-unit low-value extraction must not permanently bankrupt a company.');
assert.equal(retainsOperatingCapital(2,2,{}, { stone:2 }),true);
const last = withdrawFinite(1,100); assert.deepEqual(last,{quantity:1,remaining:0}); assert.equal(withdrawFinite(last.remaining,100).quantity,0);
const staged = collectCargo({ stone:119 },{ coal:30,stone:10 },120); assert.equal(staged.complete,false);
assert.equal(Object.values(staged.inventory).reduce((a,b)=>a+b,0)+Object.values(staged.remaining).reduce((a,b)=>a+b,0),159);
// Controlled optimistic benchmark: one starter mines an authored, already-revealed
// three-unit starter silver seam. This measures launch progression speed, not hidden-world frequency.
let silverRemaining=3, benchmarkCash=cash, minutes=0, jobs=0;
const benchmarks=[];
while (silverRemaining>0 && jobs<5) {
  const plan=calculateCrewPlan({workers:[workers[0]],mode:'extract',duration_minutes:20,path_edges:4,target_depth:3,tool_level:1,material:'silver_ore',remaining:silverRemaining});
  const finite=withdrawFinite(silverRemaining,plan.quantity); silverRemaining=finite.remaining;benchmarkCash+=finite.quantity*30-plan.wages;minutes+=20;jobs++;
  benchmarks.push({jobs,minutes,quantity:finite.quantity,cash:benchmarkCash,canAffordAllUpgrades:benchmarkCash>=allUpgradeCost+2});
}
const margins=RECIPE_CATALOG.filter(recipe=>recipe.equipment_output===null).map(recipe=>({recipe:recipe.key,margin:recipeValueAdded(recipe)}));
assert(margins.every(row=>row.margin>0&&row.margin<=34));
// The resource-only transformation graph must be acyclic: no processing recipe
// regenerates its own ore/fuel, and there is no NPC source-purchase path.
const graph=new Map();
for(const recipe of RECIPE_CATALOG)for(const input of Object.keys(recipe.inputs))for(const output of Object.keys(recipe.outputs)){const list=graph.get(input)??[];list.push(output);graph.set(input,list);}
function acyclic(node,visiting=new Set(),done=new Set()){if(visiting.has(node))throw new Error('Resource recipe cycle');if(done.has(node))return;visiting.add(node);for(const next of graph.get(node)??[])acyclic(next,visiting,done);visiting.delete(node);done.add(node);}
for(const node of graph.keys())acyclic(node);
let craftingCash=180-3-90-3, craftingStock={coal:10,stone:12,copper_ore:18};
for(const key of ['smelt_copper','craft_copper_pickaxe']){const q=productionQuote(engine.RECIPE_BY_KEY[key],1,1);craftingCash-=q.cash_cost;for(const[id,count]of Object.entries(q.inputs)){assert((craftingStock[id]??0)>=count);craftingStock[id]=(craftingStock[id]??0)-count;}for(const[id,count]of Object.entries(q.outputs))craftingStock[id]=(craftingStock[id]??0)+count;}
assert.equal(craftingCash,56);assert.equal(craftingStock.copper_bar,1);assert.equal(availableEquipmentCapacity(48,0),0);assert.equal(availableEquipmentCapacity(47,0),1);
assert.equal(EQUIPMENT_CATALOG.length,10);assert.equal(RECIPE_CATALOG.length,16);
// Phase3 field choices have real costs and bounded, route-specific utility.
const {FIELD_CATALOG,infrastructureQuote,fieldConditions,surveyPlan,routeTransportBonus,discoverySpecimen,salvageFits}=engine;
const operationCrew=workers.map(worker=>({...worker,wage:worker.base_wage}));
const fieldSite={x:48,y:100}, knownRoute=Array.from({length:101},(_,y)=>({x:48,y}));
const structures=FIELD_CATALOG.infrastructure.map(definition=>({...infrastructureQuote(definition.key,60,70).installation,id:definition.key,...fieldSite,status:'installed',job_id:'benchmark-job',installed_at:'2026-11-01T00:00:00Z'}));
const bareConditions=fieldConditions({depth:100,safety:40,energy:2,target:fieldSite,route:knownRoute,infrastructure:[]});
const protectedConditions=fieldConditions({depth:100,safety:40,energy:2,target:fieldSite,route:knownRoute,infrastructure:structures});
assert(protectedConditions.incident_chance_percent<bareConditions.incident_chance_percent);
assert.equal(protectedConditions.incident_chance_percent,0);
const entranceRail={...structures.find(item=>item.key==='rail'),y:1};
const entranceBonus=routeTransportBonus(knownRoute,[entranceRail]);
assert(entranceBonus<entranceRail.strength/4,'One short entrance track cannot discount a full deep route.');
const surveyCrewComparison=operationCrew.map(worker=>({worker:worker.name,...surveyPlan(20,worker.stats.geology,worker.traits.filter(trait=>trait==='ore_eye').length)}));
assert(surveyCrewComparison[1].tile_limit>surveyCrewComparison[0].tile_limit,'Geology provides an actual survey role.');
for(const mode of ['survey','infrastructure']) {const plan=calculateCrewPlan({workers:[operationCrew[0]],mode,duration_minutes:20,path_edges:10,target_depth:10,tool_level:1});assert.equal(plan.quantity,0);assert.equal(plan.wages,3);assert.equal(plan.energy_per_worker,1);}
for(const definition of FIELD_CATALOG.infrastructure){const quote=infrastructureQuote(definition.key,180,70);assert.equal(quote.cash_cost,definition.cash_cost*3);for(const[id,quantity]of Object.entries(quote.materials))assert.equal(quantity,definition.materials[id]*3);}
let specimens=0;
for(const definition of FIELD_CATALOG.discoveries)for(const quality of FIELD_CATALOG.qualities){const find=discoverySpecimen(definition.key,quality.key);assert(find.sale_value>=15&&find.sale_value<=500);assert(engine.resourceSaleValue(find.salvage)<=find.sale_value);specimens++;}
assert.equal(salvageFits({stone:119},{quartz:2},120),false);
assert.equal(salvageFits({stone:118},{quartz:2},120),true);
const phase3FieldProof={surveyCrewComparison,baseIncidentChance:bareConditions.incident_chance_percent,protectedIncidentChance:protectedConditions.incident_chance_percent,entranceRailWeightedBonus:entranceBonus,entranceRailStrength:entranceRail.strength,auxiliaryOperationsMintNoCargo:true,finiteSpecimenVariants:specimens,salvageNoArbitrage:true,salvageAtomicCapacity:true,shaftMaximumDepth:engine.buildingBenefits('mine_shaft',5).max_depth};
// Phase4 controlled earned route: exhaust only the real finite starter assay.
// No generated rich seams, NPC purchases, free inputs or reward retries are assumed.
const {BUSINESS_CATALOG,ALL_RECIPE_CATALOG,ALL_EQUIPMENT_CATALOG,validateBusinessCatalog,researchEffects,resourceShortfalls,contractPremium}=engine;
validateBusinessCatalog();
let businessCash=180,businessStock={},miningJobs=0,spentEnergy=0,operatingDays=1;
const starterSites=[['coal',47,1],['stone',49,1],['clay',46,1],['copper_ore',50,1],['tin_ore',47,2],['iron_ore',49,2],['quartz',47,3],['silver_ore',49,3]];
const walkable=new Set(Array.from({length:7},(_,y)=>`48:${y}`));
function starterRoute(x,y){const queue=[{x:48,y:0,edges:0}],seen=new Set(['48:0']);for(let cursor=0;cursor<queue.length;cursor++){const point=queue[cursor];if(point.x===x&&point.y===y)return point.edges;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=point.x+dx,ny=point.y+dy,key=`${nx}:${ny}`;if(!seen.has(key)&&(walkable.has(key)||nx===x&&ny===y)){seen.add(key);queue.push({x:nx,y:ny,edges:point.edges+1});}}}throw new Error('Starter site has no known depleted route');}
for(const[id,x,y]of starterSites){const amount=starterAssay[id];const pathEdges=starterRoute(x,y);
 let remaining=amount;
 while(remaining>0){if(spentEnergy===6){spentEnergy=0;operatingDays++;}const plan=calculateCrewPlan({workers:[operationCrew[0]],mode:'extract',duration_minutes:20,path_edges:pathEdges,target_depth:y,tool_level:1,material:id,remaining});const take=withdrawFinite(remaining,plan.quantity);remaining=take.remaining;businessCash-=plan.wages;businessStock[id]=(businessStock[id]??0)+take.quantity;miningJobs++;spentEnergy++;assert(businessCash>=2);}
 walkable.add(`${x}:${y}`);
}
assert.equal(engine.resourceSaleValue(businessStock),744);
// Sell the finite stock that is not needed for our chosen first alloy project.
for(const id of ['clay','iron_ore','quartz','silver_ore']){const sold=sellResource(businessStock,businessCash,id,businessStock[id]);businessStock=sold.inventory;businessCash=sold.cash;}
businessCash-=80+90;assert(businessCash>=2); // actual research office and smeltery fees
let productionSeconds=0;
function consume(resources){for(const[id,amount]of Object.entries(resources)){assert((businessStock[id]??0)>=amount,`finite stock shortage:${id}`);businessStock[id]-=amount;}}
function manufacture(key,speed=0){const q=productionQuote(engine.RECIPE_BY_KEY[key],1,1,speed);consume(q.inputs);businessCash-=q.cash_cost;assert(businessCash>=2);productionSeconds+=q.duration_seconds;for(const[id,amount]of Object.entries(q.outputs))businessStock[id]=(businessStock[id]??0)+amount;}
manufacture('smelt_copper');manufacture('smelt_tin');
const firstAlloyResearch=engine.RESEARCH_BY_KEY.processing_1;consume(firstAlloyResearch.inputs);businessCash-=firstAlloyResearch.cash_cost;assert(businessCash>=2);
const research=researchEffects(['processing_1']);assert.equal(research.processing_speed_percent,5);manufacture('smelt_bronze',research.processing_speed_percent);assert.equal(businessStock.bronze_bar,2);
const earnedAlloyCash=businessCash,alloyLiquidationValue=businessStock.bronze_bar*engine.RESOURCE_BY_ID.bronze_bar.sell_price;
const firstDeliveryShortfall=resourceShortfalls(businessStock,engine.CONTRACT_BY_KEY.yard_foundations.inputs);assert.deepEqual(firstDeliveryShortfall,{stone:8},'The finite starter stone must not fabricate a twenty-unit delivery.');
const contractMarketValue=BUSINESS_CATALOG.contracts.reduce((sum,order)=>sum+engine.resourceSaleValue(order.inputs),0),contractPayout=BUSINESS_CATALOG.contracts.reduce((sum,order)=>sum+order.reward,0),finitePremium=BUSINESS_CATALOG.contracts.reduce((sum,order)=>sum+contractPremium(order),0);
assert.equal(contractMarketValue,3976);assert.equal(contractPayout,4569);assert.equal(finitePremium,593);
const milestoneBudget=BUSINESS_CATALOG.milestones.reduce((sum,milestone)=>sum+milestone.reward,0);assert.equal(milestoneBudget,400);
const newMargins=BUSINESS_CATALOG.recipes.filter(recipe=>!recipe.equipment_output).map(recipe=>recipeValueAdded({...recipe,effective_duration_seconds:recipe.duration_seconds}));assert.deepEqual(newMargins,[20,36,30]);
const fullGraph=new Map();for(const recipe of ALL_RECIPE_CATALOG)for(const input of Object.keys(recipe.inputs))for(const output of Object.keys(recipe.outputs)){const list=fullGraph.get(input)??[];list.push(output);fullGraph.set(input,list);}
function fullAcyclic(node,path=new Set()){if(path.has(node))throw new Error('Industrial resource cycle');const next=new Set(path);next.add(node);for(const output of fullGraph.get(node)??[])fullAcyclic(output,next);}
for(const node of fullGraph.keys())fullAcyclic(node);
const businessProof={researchNodes:14,researchCashCost:BUSINESS_CATALOG.research.reduce((sum,node)=>sum+node.cash_cost,0),researchMaterialSaleValue:BUSINESS_CATALOG.research.reduce((sum,node)=>sum+engine.resourceSaleValue(node.inputs),0),finiteContracts:12,contractMarketValue,contractPayout,finiteContractPremium:finitePremium,milestoneBudget,totalFiniteCreditPremiumAndAwards:finitePremium+milestoneBudget,processingMargins:newMargins,productionDAGAcyclic:true,earnedStarterRoute:{miningJobs,operatingDays,spentEnergyLastDay:spentEnergy,researchSeconds:300,productionSeconds,bronzeBars:2,cashRemaining:earnedAlloyCash,liquidationAlternativeCash:earnedAlloyCash+alloyLiquidationValue,firstDeliveryShortfall},note:'The controlled route mines each real starter deposit once, pays every mining wage/building/recipe/research input, and counts explicit daily energy resets. Further deliveries require genuine finite exploration.'};
console.log(JSON.stringify({ rulesVersion:3,businessCatalogVersion:4,scenarios,resources:RESOURCE_CATALOG.length,starterCash:180,tutorialSeconds:30,cashAfterTutorial:cash,tutorialProfit:cash-180,firstToolUpgradeReachable:true,phase1UpgradeCashCost:allUpgradeCost,phase2AllBuildingCashCost:phase2UpgradeCost,phase3AllBuildingCashCost:phase3UpgradeCost,phase4AllBuildingCashCost:phase4UpgradeCost,productionRecipes:ALL_RECIPE_CATALOG.length,equipmentDefinitions:ALL_EQUIPMENT_CATALOG.length,materialProcessingMargins:margins,recipeGraphAcyclic:true,firstSmelterAndCopperPickaxeCashRemaining:craftingCash,equipment48CapacityRetirable:true,phase3FieldProof,businessProof,
  starterAssaySaleValue:assayValue,starterAssayCannotMaxCompanyWithin24h:true,finiteDepositConservation:true,partialCollectionConservation:true,bankruptcyCounterexampleBlocked:true,
  controlledRichSeamBenchmark:benchmarks,note:'Starter assay is permanently finite and cannot fund all upgrades. Later funds require genuine exploration; no claim of a universal24-hour minimum across all generated worlds.' },null,2));
