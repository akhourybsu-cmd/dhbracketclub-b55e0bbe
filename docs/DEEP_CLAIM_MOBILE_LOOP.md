# Deep Claim mobile session loop

This pass connects the existing persistent company systems into a short, legible session. It adds no separate reward economy, new mining rules or automatic purchase/dispatch mechanism. Verification and publication belong in the implementation ledger.

## Mobile-game reference review

“TrueMobile” did not identify a clear, relevant management-game catalog in the available search results. The review therefore uses specific mobile management games and their official descriptions rather than claiming to have played or audited every game.

| Primary source | Documented mechanic | Deep Claim application |
|---|---|---|
| [Idle Miner Tycoon](https://www.idleminertycoon.com/) | Investments, upgrades and staffing support work while away; research, collections and expeditions provide longer goals. | Keep an investment visible and make the actual return from work easy to understand. |
| [Egg, Inc. developer listing](https://play.google.com/store/apps/details?id=com.auxbrain.egginc) | Resource/investment choices, growing facilities, challenges, contracts and artifact collection/crafting. | Connect mining and production to a concrete owned-company objective. |
| [Township Helicopter Pad](https://playrix.helpshift.com/hc/en/3-township/faq/15031-helicopter-pad/) | Players choose which resource orders to fulfill and collect their requirements. | Let an existing delivery order become the company's chosen goal. |
| [Township production](https://playrix.helpshift.com/hc/en/3-township/faq/15993-farming-production/) | Raw resources feed processing and factory development. | Surface collected-input requirements and route the player to the real workshop or transaction. |
| [Tiny Tower developer site](https://shop.nimblebit.com/home) | Named residents, job assignments, collecting/reinvesting and visible building/elevator growth. | Preserve crew identity and direct returned crews into an editable next-shift plan. |

These are design inferences from published mechanics. Store descriptions do not establish which individual mechanic causes retention, and no claim of measured addiction or increased retention is made. Deep Claim keeps its own persistent mine, finite work budgets, original art and company economy.

## The implemented loop

**Choose a company goal → plan and confirm a shift → return to a source-backed report → collect actual cargo → invest or process → plan the next shift.**

### One visible company goal

The surface goal dock opens four small categories: buildings, research, delivery contracts and existing company milestones. Four cards per page keep the planner bounded. Pinning a goal is a planning preference, not a purchase, unlock, currency award or new achievement.

Every requirement is reevaluated from the current authorized snapshot. Cash includes the two-credit operating reserve; materials use collected inventory; building/research/contract prerequisites use confirmed records. Milestone progress uses the actual server milestone record, not a client reconstruction from a short history. A running research timer never completes its goal until a confirmed completion arrives.

A pinned building target remains complete when the building reaches or exceeds that level. Selecting a different project is optional. Review opens the exact existing building, research, contract or milestone screen and retains its price, revision, permission and confirmation checks. No new fictional company rank or extra reward is attached.

### A factual return report

After Continue, a report can summarize newly ready mining cargo, ready production, pending finds and newly confirmed research. The first authorized visit establishes a quiet baseline. Reports wait while another dialog or the tutorial needs attention and appear once per visit. The manual report control can reopen currently ready work.

Active work remains active even if its displayed deadline elapsed. Returned goods are described as awaiting storage, not already owned. Balance changes are not reported as offline profit. Closing or reviewing the report acknowledges presentation only; collecting cargo, production or a specimen still requires the existing authorized action. Partial cargo stays staged and visible.

### Less repeated planning

After positive, fully confirmed haul collection, an available **Plan next shift** action prepares an ordinary editable draft. It reuses eligible previous workers and duration, validates current crew/storage/slot/find limits, and retains the worksite only if it remains legal. A depleted site is replaced by an available public destination, preferring the same known material where possible. No legal destination means no misleading plan button.

An induction return creates a normal 20-minute draft, never a second accelerated tutorial. The draft always requires a new server estimate and explicit dispatch confirmation. Previous rows, frozen expeditions and their rewards remain unchanged.

## Persistence and authority

Company progression remains on the server. The pinned goal identity and report-read receipts are bounded device preferences scoped by user, club and company, like existing presentation settings. They do not synchronize their UI selection/read state between devices; each device still reads the same authoritative company progress. Missing, corrupt, inaccessible or foreign preference data cannot authorize an action or supply progress. Blocked storage permits the current session to continue.

The implementation reuses current catalogs, private-company RPCs, notifications, collections and original painters. No SQL migration, new global service, new score system, trade currency or additional recurring notification is required.

## Verification and future decisions

Meaningful checks cover exact goal routing and costs, source-confirmed completion, preference isolation, real return/collection, partial cargo, unavailable crews, depleted destinations, ordinary induction follow-ups and no automatic economic writes. Native QA uses isolated PostgreSQL and actual production components.

Further content and pacing changes should be separately versioned and balance-tested. Useful next measurements are time to first investment, clear next-action comprehension, completed-shift value and voluntary return behavior. A longer contract library, more geological events or cross-device plan preferences should extend the current authorities; this pass does not label those future systems as shipped.
