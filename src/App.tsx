import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClubProvider } from "@/contexts/ClubContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ClubGate } from "@/components/ClubGate";
import { AppLayout } from "@/components/AppLayout";
import { PageTransition } from "@/components/PageTransition";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useOfflineIndicator } from "@/hooks/useOfflineIndicator";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { useThemeChrome } from "@/hooks/useThemeChrome";
import { MemberRouteErrorBoundary } from "@/components/member/MemberRouteErrorBoundary";

// Lazy-loaded pages for code splitting
const LandingPage = lazyWithRetry(() => import("./pages/LandingPage"));
const AuthPage = lazyWithRetry(() => import("./pages/AuthPage"));
const DashboardPage = lazyWithRetry(() => import("./pages/DashboardPage"));
const ClubPage = lazyWithRetry(() => import("./pages/ClubPage"));
const CreatePoolPage = lazyWithRetry(() => import("./pages/CreatePoolPage"));
const JoinPoolPage = lazyWithRetry(() => import("./pages/JoinPoolPage"));
const PoolDetailPage = lazyWithRetry(() => import("./pages/PoolDetailPage"));
const PoolsListPage = lazyWithRetry(() => import("./pages/PoolsListPage"));
const PoolSettingsPage = lazyWithRetry(() => import("./pages/PoolSettingsPage"));
const BracketEntryPage = lazyWithRetry(() => import("./pages/BracketEntryPage"));
const BracketDetailPage = lazyWithRetry(() => import("./pages/BracketDetailPage"));
const BracketComparePage = lazyWithRetry(() => import("./pages/BracketComparePage"));
const LeaderboardPage = lazyWithRetry(() => import("./pages/LeaderboardPage"));
const AdminToolsPage = lazyWithRetry(() => import("./pages/AdminToolsPage"));
const RuneDelveAnalyticsPage = lazyWithRetry(() => import("./pages/RuneDelveAnalyticsPage"));
const RuneDelveSimulatorPage = lazyWithRetry(() => import("./pages/RuneDelveSimulatorPage"));
const RuneDelveBalanceReportPage = lazyWithRetry(() => import("./pages/RuneDelveBalanceReportPage"));
const GameCenterPage = lazyWithRetry(() => import("./pages/GameCenterPage"));
const ProfilePage = lazyWithRetry(() => import("./pages/ProfilePage"));
const NotificationsPage = lazyWithRetry(() => import("./pages/NotificationsPage"));
const ResetPasswordPage = lazyWithRetry(() => import("./pages/ResetPasswordPage"));
const RankingsListPage = lazyWithRetry(() => import("./pages/RankingsListPage"));
const CreateRankingPage = lazyWithRetry(() => import("./pages/CreateRankingPage"));
const RankingDetailPage = lazyWithRetry(() => import("./pages/RankingDetailPage"));
const PollsListPage = lazyWithRetry(() => import("./pages/PollsListPage"));
const CreatePollPage = lazyWithRetry(() => import("./pages/CreatePollPage"));
const PollDetailPage = lazyWithRetry(() => import("./pages/PollDetailPage"));
const DraftsListPage = lazyWithRetry(() => import("./pages/DraftsListPage"));
const CreateDraftPage = lazyWithRetry(() => import("./pages/CreateDraftPage"));
const DraftDetailPage = lazyWithRetry(() => import("./pages/DraftDetailPage"));
const ReadshiftListPage = lazyWithRetry(() => import("./pages/ReadshiftListPage"));
const CreateReadshiftPage = lazyWithRetry(() => import("./pages/CreateReadshiftPage"));
const ReadshiftGamePage = lazyWithRetry(() => import("./pages/ReadshiftGamePage"));
const SeasonsArchivePage = lazyWithRetry(() => import("./pages/SeasonsArchivePage"));
const SeasonArchiveDetailPage = lazyWithRetry(() => import("./pages/SeasonArchiveDetailPage"));
const ChatPage = lazyWithRetry(() => import("./pages/ChatPage"));
const EventsPage = lazyWithRetry(() => import("./pages/EventsPage"));
const EventDetailPage = lazyWithRetry(() => import("./pages/EventDetailPage"));
const CompetePage = lazyWithRetry(() => import("./pages/CompetePage"));
const LockboxPage = lazyWithRetry(() => import("./pages/LockboxPage"));
const LockboxCrackPage = lazyWithRetry(() => import("./pages/LockboxCrackPage"));
const FeedPage = lazyWithRetry(() => import("./pages/FeedPage"));
const LorePage = lazyWithRetry(() => import("./pages/LorePage"));
const LoreDetailPage = lazyWithRetry(() => import("./pages/LoreDetailPage"));
const PostsPage = lazyWithRetry(() => import("./pages/PostsPage"));
const PostDetailPage = lazyWithRetry(() => import("./pages/PostDetailPage"));
const SharedMediaPage = lazyWithRetry(() => import("./pages/SharedMediaPage"));
const PickemHomePage = lazyWithRetry(() => import("./pages/PickemHomePage"));
const PickemWeekPage = lazyWithRetry(() => import("./pages/PickemWeekPage"));
const PickemWeekResultsPage = lazyWithRetry(() => import("./pages/PickemWeekResultsPage"));
const PickemStandingsPage = lazyWithRetry(() => import("./pages/PickemStandingsPage"));
const PickemHistoryPage = lazyWithRetry(() => import("./pages/PickemHistoryPage"));
const PickemRulesPage = lazyWithRetry(() => import("./pages/PickemRulesPage"));
const PickemAdminPage = lazyWithRetry(() => import("./pages/PickemAdminPage"));
const RuneDelveHomePage = lazyWithRetry(() => import("./pages/RuneDelveHomePage"));
const RuneDelveLevelMapPage = lazyWithRetry(() => import("./pages/RuneDelveLevelMapPage"));
const RuneDelvePlayPage = lazyWithRetry(() => import("./pages/RuneDelvePlayPage"));
const RuneDelveResultsPage = lazyWithRetry(() => import("./pages/RuneDelveResultsPage"));
const RuneDelveLeaderboardPage = lazyWithRetry(() => import("./pages/RuneDelveLeaderboardPage"));
const RuneDelveHeroPage = lazyWithRetry(() => import("./pages/RuneDelveHeroPage"));
const RuneDelveHistoryPage = lazyWithRetry(() => import("./pages/RuneDelveHistoryPage"));
const RuneDelveShopPage = lazyWithRetry(() => import("./pages/RuneDelveShopPage"));
const RuneDelveArmoryPage = lazyWithRetry(() => import("./pages/RuneDelveArmoryPage"));
const RuneDelveBestiaryPage = lazyWithRetry(() => import("./pages/RuneDelveBestiaryPage"));
const RuneDelveDailyPage = lazyWithRetry(() => import("./pages/RuneDelveDailyPage"));
const RuneDelveEndlessPage = lazyWithRetry(() => import("./pages/RuneDelveEndlessPage"));
const RuneDelveQuestsPage = lazyWithRetry(() => import("./pages/RuneDelveQuestsPage"));
const CelebrationsPage = lazyWithRetry(() => import("./pages/CelebrationsPage"));
const WorkoutPage = lazyWithRetry(() => import("./pages/WorkoutPage"));
const WorkoutAdminPage = lazyWithRetry(() => import("./pages/WorkoutAdminPage"));
const WorkoutRecapPage = lazyWithRetry(() => import("./pages/WorkoutRecapPage"));
const WorkoutLogPage = lazyWithRetry(() => import("./pages/WorkoutLogPage"));
const JourneyHomePage = lazyWithRetry(() => import("./pages/journey/JourneyHomePage"));
const JourneyPlayPage = lazyWithRetry(() => import("./pages/journey/JourneyPlayPage"));
const JourneyCharacterPage = lazyWithRetry(() => import("./pages/journey/JourneyCharacterPage"));
const JourneyJournalPage = lazyWithRetry(() => import("./pages/journey/JourneyJournalPage"));
const JourneyWorldPage = lazyWithRetry(() => import("./pages/journey/JourneyWorldPage"));
const JourneyStudioPage = lazyWithRetry(() => import("./pages/journey/JourneyStudioPage"));
const NarrativeCampaignsPage = lazyWithRetry(() => import("./pages/NarrativeCampaignsPage"));
const NarrativeCampaignCreatePage = lazyWithRetry(() => import("./pages/NarrativeCampaignCreatePage"));
const NarrativeCampaignDetailPage = lazyWithRetry(() => import("./pages/NarrativeCampaignDetailPage"));
const RequestClubPage = lazyWithRetry(() => import("./pages/RequestClubPage"));
const AdminClubsPage = lazyWithRetry(() => import("./pages/AdminClubsPage"));
const ClubSettingsPage = lazyWithRetry(() => import("./pages/ClubSettingsPage"));
const AiUsageReportPage = lazyWithRetry(() => import("./pages/AiUsageReportPage"));
const AdminDashboardPage = lazyWithRetry(() => import("./pages/AdminDashboardPage"));
const AdminUsersPage = lazyWithRetry(() => import("./pages/AdminUsersPage"));
const AdminCompetitionsPage = lazyWithRetry(() => import("./pages/AdminCompetitionsPage"));
const AdminAuditPage = lazyWithRetry(() => import("./pages/AdminAuditPage"));
const AdminDiagnosticsPage = lazyWithRetry(() => import("./pages/AdminDiagnosticsPage"));
const AdminAnnouncementsPage = lazyWithRetry(() => import("./pages/AdminAnnouncementsPage"));
const AdminFeatureFlagsPage = lazyWithRetry(() => import("./pages/AdminFeatureFlagsPage"));
const AdminNotesPage = lazyWithRetry(() => import("./pages/AdminNotesPage"));
const AdminAssetCatalogPage = lazyWithRetry(() => import("./pages/AdminAssetCatalogPage"));
const ClubAssetsPage = lazyWithRetry(() => import("./pages/ClubAssetsPage"));
import { AdminRoute } from "./components/auth/AdminRoute";
import { ClubAdminRoute } from "./components/auth/ClubAdminRoute";
import { AssetGuard } from "./components/auth/AssetGuard";
const NexusHomePage = lazyWithRetry(() => import("./pages/NexusHomePage"));
const NexusMissionsPage = lazyWithRetry(() => import("./pages/NexusMissionsPage"));
const NexusLoadoutPage = lazyWithRetry(() => import("./pages/NexusLoadoutPage"));
const NexusBattlePage = lazyWithRetry(() => import("./pages/NexusBattlePage"));
const NexusResultsPage = lazyWithRetry(() => import("./pages/NexusResultsPage"));
const NexusLeaderboardPage = lazyWithRetry(() => import("./pages/NexusLeaderboardPage"));
const NexusCodexPage = lazyWithRetry(() => import("./pages/NexusCodexPage"));
const NexusBalancePage = lazyWithRetry(() => import("./pages/NexusBalancePage"));
const NexusCalibrationPage = lazyWithRetry(() => import("./pages/NexusCalibrationPage"));
const NexusOperationPage = lazyWithRetry(() => import("./pages/NexusOperationPage"));
const NexusSigilVaultPage = lazyWithRetry(() => import("./pages/NexusSigilVaultPage"));
const NexusSimulatorPage = lazyWithRetry(() => import("./pages/NexusSimulatorPage"));
const NexusMissionWorkshopPage = lazyWithRetry(() => import("./pages/NexusMissionWorkshopPage"));
const PortfolioWarsPage = lazyWithRetry(() => import("./pages/PortfolioWarsPage"));
const PwLayout = lazyWithRetry(() => import("./components/portfolioWars/PwLayout").then(m => ({ default: m.PwLayout })));
const RuneDelveLayout = lazyWithRetry(() => import("./components/runedelve/RuneDelveLayout").then(m => ({ default: m.RuneDelveLayout })));
const NexusLayout = lazyWithRetry(() => import("./components/nexus/NexusLayout").then(m => ({ default: m.NexusLayout })));
const PickemLayout = lazyWithRetry(() => import("./components/pickem/PickemLayout").then(m => ({ default: m.PickemLayout })));
const DraftArenaLayout = lazyWithRetry(() => import("./components/drafts/DraftArenaLayout").then(m => ({ default: m.DraftArenaLayout })));
const ForgeLayout = lazyWithRetry(() => import("./components/workout/ForgeLayout").then(m => ({ default: m.ForgeLayout })));
const ReadshiftLayout = lazyWithRetry(() => import("./components/readshift/ReadshiftLayout").then(m => ({ default: m.ReadshiftLayout })));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes — prevents redundant refetches
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Minimal loading fallback that matches the app's visual language
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="loading-spinner-ring" />
    </div>
  );
}

const ProtectedPage = ({
  children,
  assetSlug,
}: {
  children: React.ReactNode;
  /** When set, also requires the named asset to be installed for the active club. App admins bypass. */
  assetSlug?: string;
}) => (
  <PageTransition>
    <Suspense fallback={<PageFallback />}>
      {assetSlug ? <AssetGuard slug={assetSlug}>{children}</AssetGuard> : children}
    </Suspense>
  </PageTransition>
);

function AnimatedRoutes() {
  const location = useLocation();

  const routes = (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Suspense fallback={<PageFallback />}><LandingPage /></Suspense>} />
        <Route path="/auth" element={<Suspense fallback={<PageFallback />}><AuthPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<PageFallback />}><ResetPasswordPage /></Suspense>} />

        {/* Dashboard / Home */}
        <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
        <Route path="/club" element={<ProtectedPage><ClubPage /></ProtectedPage>} />

        {/* Chat */}
        <Route path="/chat" element={<ProtectedPage assetSlug="chat"><ChatPage /></ProtectedPage>} />
        <Route path="/shared" element={<ProtectedPage assetSlug="shared-media"><SharedMediaPage /></ProtectedPage>} />

        {/* Events */}
        <Route path="/events" element={<ProtectedPage assetSlug="events"><EventsPage /></ProtectedPage>} />
        <Route path="/events/:eventId" element={<ProtectedPage assetSlug="events"><EventDetailPage /></ProtectedPage>} />

        {/* Compete hub */}
        <Route path="/compete" element={<ProtectedPage><CompetePage /></ProtectedPage>} />

        {/* Portfolio Wars — weekly stock-picking challenge */}
        <Route path="/portfolio-wars" element={<ProtectedPage assetSlug="portfolio-wars"><PwLayout><PortfolioWarsPage /></PwLayout></ProtectedPage>} />

        {/* Lockbox module */}
        <Route path="/lockbox" element={<ProtectedPage assetSlug="lockbox"><LockboxPage /></ProtectedPage>} />
        <Route path="/lockbox/:lockId" element={<ProtectedPage assetSlug="lockbox"><LockboxCrackPage /></ProtectedPage>} />

        {/* DH Lore */}
        <Route path="/lore" element={<ProtectedPage assetSlug="lore"><LorePage /></ProtectedPage>} />
        <Route path="/lore/:loreId" element={<ProtectedPage assetSlug="lore"><LoreDetailPage /></ProtectedPage>} />

        {/* Feed + Posts */}
        <Route path="/feed" element={<ProtectedPage assetSlug="feed"><FeedPage /></ProtectedPage>} />
        <Route path="/posts" element={<ProtectedPage assetSlug="posts"><PostsPage /></ProtectedPage>} />
        <Route path="/posts/create" element={<ProtectedPage assetSlug="posts"><PostsPage /></ProtectedPage>} />
        <Route path="/posts/:postId" element={<ProtectedPage assetSlug="posts"><PostDetailPage /></ProtectedPage>} />

        {/* Brackets module */}
        <Route path="/brackets" element={<ProtectedPage assetSlug="brackets"><PoolsListPage /></ProtectedPage>} />
        <Route path="/pools" element={<Navigate to="/brackets" replace />} />
        <Route path="/pools/create" element={<ProtectedPage assetSlug="brackets"><CreatePoolPage /></ProtectedPage>} />
        <Route path="/pools/join" element={<ProtectedPage assetSlug="brackets"><JoinPoolPage /></ProtectedPage>} />
        <Route path="/pools/:poolId" element={<ProtectedPage assetSlug="brackets"><PoolDetailPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/settings" element={<ProtectedPage assetSlug="brackets"><PoolSettingsPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/bracket/edit" element={<ProtectedPage assetSlug="brackets"><BracketEntryPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/bracket/compare" element={<ProtectedPage assetSlug="brackets"><BracketComparePage /></ProtectedPage>} />
        <Route path="/pools/:poolId/bracket/:bracketId" element={<ProtectedPage assetSlug="brackets"><BracketDetailPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/leaderboard" element={<ProtectedPage assetSlug="brackets"><LeaderboardPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/admin" element={<ProtectedPage assetSlug="brackets"><AdminToolsPage /></ProtectedPage>} />
        <Route path="/pools/:poolId/games" element={<ProtectedPage assetSlug="brackets"><GameCenterPage /></ProtectedPage>} />

        {/* Rankings module */}
        <Route path="/rankings" element={<ProtectedPage assetSlug="rankings"><RankingsListPage /></ProtectedPage>} />
        <Route path="/rankings/create" element={<ProtectedPage assetSlug="rankings"><CreateRankingPage /></ProtectedPage>} />
        <Route path="/rankings/:rankingId" element={<ProtectedPage assetSlug="rankings"><RankingDetailPage /></ProtectedPage>} />

        {/* Polls module */}
        <Route path="/polls" element={<ProtectedPage assetSlug="polls"><PollsListPage /></ProtectedPage>} />
        <Route path="/polls/create" element={<ProtectedPage assetSlug="polls"><CreatePollPage /></ProtectedPage>} />
        <Route path="/polls/:pollId" element={<ProtectedPage assetSlug="polls"><PollDetailPage /></ProtectedPage>} />

        {/* Drafts module — standalone Draft Arena shell (own boot, HUD, no DH chrome) */}
        <Route path="/drafts" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><DraftsListPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/seasons" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><SeasonsArchivePage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/seasons/:seasonId" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><SeasonArchiveDetailPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/create" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><CreateDraftPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/:draftId" element={<ProtectedPage assetSlug="draft-arena"><DraftArenaLayout><DraftDetailPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/readshift" element={<ProtectedPage assetSlug="readshift"><ReadshiftLayout><ReadshiftListPage /></ReadshiftLayout></ProtectedPage>} />
        <Route path="/readshift/create" element={<ProtectedPage assetSlug="readshift"><ReadshiftLayout><CreateReadshiftPage /></ReadshiftLayout></ProtectedPage>} />
        <Route path="/readshift/:gameId" element={<ProtectedPage assetSlug="readshift"><ReadshiftLayout><ReadshiftGamePage /></ReadshiftLayout></ProtectedPage>} />

        {/* NFL Pick'em module — standalone shell (own boot, HUD, no DH chrome) */}
        <Route path="/pickem" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemHomePage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/week/:weekNumber" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemWeekPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/week/:weekNumber/results" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemWeekResultsPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/standings" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemStandingsPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/history" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemHistoryPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/rules" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemRulesPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/admin" element={<ProtectedPage assetSlug="nfl-pickem"><PickemLayout><PickemAdminPage /></PickemLayout></ProtectedPage>} />

        {/* Rune Delve module — campaign */}
        <Route path="/rune-delve" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveHomePage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/levels" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveLevelMapPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/play/:levelNumber" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelvePlayPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/results/:levelNumber" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveResultsPage /></RuneDelveLayout></ProtectedPage>} />
        {/* Back-compat redirects from old daily routes */}
        <Route path="/rune-delve/play" element={<Navigate to="/rune-delve/levels" replace />} />
        <Route path="/rune-delve/results" element={<Navigate to="/rune-delve" replace />} />
        <Route path="/rune-delve/leaderboard" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveLeaderboardPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/hero" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveHeroPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/history" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveHistoryPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/shop" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveShopPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/armory" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveArmoryPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/bestiary" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveBestiaryPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/daily" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveDailyPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/endless" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveEndlessPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/quests" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveLayout><RuneDelveQuestsPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/analytics" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveAnalyticsPage /></ProtectedPage>} />
        <Route path="/rune-delve/simulator" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveSimulatorPage /></ProtectedPage>} />
        <Route path="/rune-delve/balance" element={<ProtectedPage assetSlug="rune-delve"><RuneDelveBalanceReportPage /></ProtectedPage>} />

        {/* Nexus Defense — sci-fi tower defense (full-screen game shell) */}
        <Route path="/nexus" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusHomePage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/missions" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusMissionsPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/loadout/:missionId" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusLoadoutPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/battle/:missionId" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusBattlePage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/results/:missionId" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusResultsPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/leaderboard" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusLeaderboardPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/codex" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusCodexPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/operation" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusOperationPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/sigils" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusSigilVaultPage /></NexusLayout></ProtectedPage>} />
        {/* Admin tuning tools — reachable only from the platform admin area,
            not the player-facing Nexus hub (trim-hard pass). */}
        <Route path="/nexus/balance" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusBalancePage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/calibration" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusCalibrationPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/simulator" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusSimulatorPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/mission-workshop" element={<ProtectedPage assetSlug="nexus-defense"><NexusLayout><NexusMissionWorkshopPage /></NexusLayout></ProtectedPage>} />

        <Route path="/profile" element={<ProtectedPage><ProfilePage /></ProtectedPage>} />
        <Route path="/notifications" element={<ProtectedPage><NotificationsPage /></ProtectedPage>} />
        <Route path="/celebrations" element={<ProtectedPage assetSlug="birthdays-milestones"><CelebrationsPage /></ProtectedPage>} />
        <Route path="/workouts" element={<ProtectedPage assetSlug="workout-competition"><ForgeLayout><WorkoutPage /></ForgeLayout></ProtectedPage>} />
        <Route path="/workouts/log" element={<ProtectedPage assetSlug="workout-competition"><ForgeLayout><WorkoutLogPage /></ForgeLayout></ProtectedPage>} />
        <Route path="/workouts/admin" element={<ProtectedPage assetSlug="workout-competition"><ClubAdminRoute><ForgeLayout><WorkoutAdminPage /></ForgeLayout></ClubAdminRoute></ProtectedPage>} />
        <Route path="/workouts/recap/:weekId" element={<ProtectedPage assetSlug="workout-competition"><ForgeLayout><WorkoutRecapPage /></ForgeLayout></ProtectedPage>} />
        {/* The Splendid Journey — studio is admin-only, play surfaces are asset-gated. */}
        <Route path="/journey" element={<ProtectedPage assetSlug="splendid-journey"><JourneyHomePage /></ProtectedPage>} />
        <Route path="/journey/play/:runId" element={<ProtectedPage assetSlug="splendid-journey"><JourneyPlayPage /></ProtectedPage>} />
        <Route path="/journey/character" element={<ProtectedPage assetSlug="splendid-journey"><JourneyCharacterPage /></ProtectedPage>} />
        <Route path="/journey/journal" element={<ProtectedPage assetSlug="splendid-journey"><JourneyJournalPage /></ProtectedPage>} />
        <Route path="/journey/world" element={<ProtectedPage assetSlug="splendid-journey"><JourneyWorldPage /></ProtectedPage>} />
        <Route path="/journey/studio" element={<ProtectedPage><AdminRoute><JourneyStudioPage /></AdminRoute></ProtectedPage>} />
        <Route path="/narrative" element={<ProtectedPage assetSlug="narrative-rpg"><NarrativeCampaignsPage /></ProtectedPage>} />
        <Route path="/narrative/new" element={<ProtectedPage assetSlug="narrative-rpg"><NarrativeCampaignCreatePage /></ProtectedPage>} />
        <Route path="/narrative/:campaignId" element={<ProtectedPage assetSlug="narrative-rpg"><NarrativeCampaignDetailPage /></ProtectedPage>} />

        {/* Clubs (multi-tenant) */}
        <Route path="/club/request" element={<ProtectedRoute><Suspense fallback={<PageFallback />}><RequestClubPage /></Suspense></ProtectedRoute>} />
        <Route path="/club/settings" element={<ProtectedPage><ClubAdminRoute><ClubSettingsPage /></ClubAdminRoute></ProtectedPage>} />
        <Route path="/clubs/:clubId/settings" element={<ProtectedPage><ClubAdminRoute><ClubSettingsPage /></ClubAdminRoute></ProtectedPage>} />
        <Route path="/club/assets" element={<ProtectedPage><ClubAdminRoute><ClubAssetsPage /></ClubAdminRoute></ProtectedPage>} />
        <Route path="/club/ai-usage" element={<ProtectedPage><ClubAdminRoute><AiUsageReportPage /></ClubAdminRoute></ProtectedPage>} />

        {/* Admin Portal — global platform controls (gated to is_app_admin / platform owner) */}
        <Route path="/admin" element={<ProtectedPage><AdminRoute><AdminDashboardPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/clubs" element={<ProtectedPage><AdminRoute><AdminClubsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/users" element={<ProtectedPage><AdminRoute><AdminUsersPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/competitions" element={<ProtectedPage><AdminRoute><AdminCompetitionsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/announcements" element={<ProtectedPage><AdminRoute><AdminAnnouncementsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/feature-flags" element={<ProtectedPage><AdminRoute><AdminFeatureFlagsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/notes" element={<ProtectedPage><AdminRoute><AdminNotesPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/audit" element={<ProtectedPage><AdminRoute><AdminAuditPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/diagnostics" element={<ProtectedPage><AdminRoute><AdminDiagnosticsPage /></AdminRoute></ProtectedPage>} />
        <Route path="/admin/assets" element={<ProtectedPage><AdminRoute><AdminAssetCatalogPage /></AdminRoute></ProtectedPage>} />
        {/* Legacy alias */}
        <Route path="/club-settings" element={<Navigate to="/club/settings" replace />} />

        <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
      </Routes>
    </AnimatePresence>
  );

  // Keep the everyday app chrome mounted across route changes. Previously
  // every route created its own AppLayout, re-running unread queries and
  // rebuilding navigation on each tap. Public/auth and club-request routes
  // intentionally remain outside the club shell.
  const shellless = location.pathname === '/' ||
    location.pathname === '/auth' ||
    location.pathname === '/reset-password' ||
    location.pathname === '/club/request';

  if (shellless) {
    return <MemberRouteErrorBoundary resetKey={location.pathname}>{routes}</MemberRouteErrorBoundary>;
  }

  return (
    <ProtectedRoute>
      <ClubGate>
        <MemberRouteErrorBoundary resetKey={location.pathname}>
          <AppLayout>{routes}</AppLayout>
        </MemberRouteErrorBoundary>
      </ClubGate>
    </ProtectedRoute>
  );
}

function AppWithUpdate() {
  useAppUpdate();
  useOfflineIndicator();
  useRoutePrefetch();
  useThemeChrome();
  return <AnimatedRoutes />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <ClubProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <AppWithUpdate />
            </BrowserRouter>
          </TooltipProvider>
        </ClubProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
