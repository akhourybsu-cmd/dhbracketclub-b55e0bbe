// Deterministic, offline v1 economy guardrails. No production accounts, writes or hidden geography.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const built = await build({ stdin: { contents: `export * from './src/lib/deepClaim/types.ts'; export * from './src/lib/deepClaim/catalog.ts'; export * from './src/lib/deepClaim/simulation.ts'; export * from './src/lib/deepClaim/production.ts';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
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
const phase2UpgradeCost=Object.values(BUILDING_UPGRADE_COSTS).flat().reduce((sum,cost)=>sum+cost,0);
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
console.log(JSON.stringify({ rulesVersion:2,scenarios,resources:RESOURCE_CATALOG.length,starterCash:180,tutorialSeconds:30,cashAfterTutorial:cash,tutorialProfit:cash-180,firstToolUpgradeReachable:true,phase1UpgradeCashCost:allUpgradeCost,phase2AllBuildingCashCost:phase2UpgradeCost,productionRecipes:RECIPE_CATALOG.length,equipmentDefinitions:EQUIPMENT_CATALOG.length,materialProcessingMargins:margins,recipeGraphAcyclic:true,firstSmelterAndCopperPickaxeCashRemaining:craftingCash,equipment48CapacityRetirable:true,
  starterAssaySaleValue:assayValue,starterAssayCannotMaxCompanyWithin24h:true,finiteDepositConservation:true,partialCollectionConservation:true,bankruptcyCounterexampleBlocked:true,
  controlledRichSeamBenchmark:benchmarks,note:'Starter assay is permanently finite and cannot fund all upgrades. Later funds require genuine exploration; no claim of a universal24-hour minimum across all generated worlds.' },null,2));
