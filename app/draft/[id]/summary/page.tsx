'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DraftState, Player, Team } from '@/lib/types';
import { Logo } from '@/components/ui/logo';

// Roster slot assignment for display
interface RosterSlot {
  id: string;
  label: string;
  position: string | string[];
  player: Player | null;
}

function assignPlayersToRosterSlots(roster: Player[]): RosterSlot[] {
  const slots: RosterSlot[] = [
    { id: 'qb', label: 'QB', position: 'QB', player: null },
    { id: 'rb1', label: 'RB1', position: 'RB', player: null },
    { id: 'rb2', label: 'RB2', position: 'RB', player: null },
    { id: 'wr1', label: 'WR1', position: 'WR', player: null },
    { id: 'wr2', label: 'WR2', position: 'WR', player: null },
    { id: 'te', label: 'TE', position: 'TE', player: null },
    { id: 'flex', label: 'FLEX', position: ['RB', 'WR', 'TE'], player: null },
    { id: 'k', label: 'K', position: 'K', player: null },
    { id: 'def', label: 'DEF', position: 'DEF', player: null },
    { id: 'bench1', label: 'BN', position: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'], player: null },
    { id: 'bench2', label: 'BN', position: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'], player: null },
    { id: 'bench3', label: 'BN', position: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'], player: null },
    { id: 'bench4', label: 'BN', position: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'], player: null },
  ];

  const assignedPlayerIds = new Set<string>();

  // First pass: primary positions
  for (const player of roster) {
    for (const slot of slots) {
      if (slot.player || assignedPlayerIds.has(player.id)) continue;
      const isMatch = !Array.isArray(slot.position) && slot.position === player.position;
      if (isMatch) {
        slot.player = player;
        assignedPlayerIds.add(player.id);
        break;
      }
    }
  }

  // Second pass: FLEX
  for (const player of roster) {
    if (assignedPlayerIds.has(player.id)) continue;
    const flexSlot = slots.find(s => s.id === 'flex' && !s.player);
    if (flexSlot && ['RB', 'WR', 'TE'].includes(player.position)) {
      flexSlot.player = player;
      assignedPlayerIds.add(player.id);
    }
  }

  // Third pass: bench
  for (const player of roster) {
    if (assignedPlayerIds.has(player.id)) continue;
    const benchSlot = slots.find(s => s.id.startsWith('bench') && !s.player);
    if (benchSlot) {
      benchSlot.player = player;
      assignedPlayerIds.add(player.id);
    }
  }

  return slots;
}

function calculateTeamStats(roster: Player[]) {
  const totalProjected = roster.reduce((sum, p) => sum + (p.projectedPoints || 0), 0);
  const avgADP = roster.length > 0
    ? roster.reduce((sum, p) => sum + p.adp, 0) / roster.length
    : 0;

  const positionCounts: Record<string, number> = {};
  roster.forEach(p => {
    positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
  });

  return { totalProjected, avgADP, positionCounts };
}

export default function DraftSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.id as string;

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    loadDraft();
  }, [draftId]);

  const loadDraft = async () => {
    try {
      const response = await fetch(`/api/draft/${draftId}`);
      const data = await response.json();

      if (data.success) {
        setDraft(data.data);
        // Default to user's team
        const userTeam = data.data.teams.find((t: Team) => t.isUser);
        if (userTeam) {
          setSelectedTeam(userTeam.id);
        }
      } else {
        alert('Draft not found');
        router.push('/');
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      alert('Failed to load draft');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-900 text-xl">Loading draft summary...</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-900 text-xl">Draft not found</div>
      </div>
    );
  }

  // Sort teams by projected points
  const sortedTeams = [...draft.teams].sort((a, b) => {
    const aStats = calculateTeamStats(a.roster);
    const bStats = calculateTeamStats(b.roster);
    return bStats.totalProjected - aStats.totalProjected;
  });

  const selectedTeamData = draft.teams.find(t => t.id === selectedTeam);
  const selectedTeamStats = selectedTeamData ? calculateTeamStats(selectedTeamData.roster) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Draft Summary</p>
              <button
                onClick={() => router.push('/')}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-medium"
              >
                Start New Draft
              </button>
            </div>
            <Logo size="md" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Draft Complete Banner */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 mb-6 text-white text-center shadow-lg">
          <h2 className="text-3xl font-bold mb-2">Draft Complete!</h2>
          <p className="text-green-100">
            {draft.teams.length} teams · {draft.picks.length} picks · {draft.settings.scoringType.toUpperCase()} scoring
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left: Team Rankings */}
          <div className="col-span-4 bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Team Rankings</h2>
            <div className="space-y-2">
              {sortedTeams.map((team, index) => {
                const stats = calculateTeamStats(team.roster);
                return (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all border ${
                      selectedTeam === team.id
                        ? 'bg-blue-50 border-blue-500 shadow-sm'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          {team.name}
                          {team.isUser && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">You</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {stats.totalProjected.toFixed(1)} proj pts
                        </div>
                      </div>
                      {team.aiProfile && !team.isUser && (
                        <div className="text-xs text-gray-400">
                          {team.aiProfile.name}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Team Roster */}
          <div className="col-span-8 bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            {selectedTeamData && selectedTeamStats ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {selectedTeamData.name}
                      {selectedTeamData.isUser && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Your Team</span>
                      )}
                    </h2>
                    {selectedTeamData.aiProfile && !selectedTeamData.isUser && (
                      <p className="text-sm text-gray-500">AI: {selectedTeamData.aiProfile.name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedTeamStats.totalProjected.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">Projected Points</div>
                  </div>
                </div>

                {/* Team Stats */}
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map(pos => (
                    <div key={pos} className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">{pos}</div>
                      <div className="font-bold text-gray-900">{selectedTeamStats.positionCounts[pos] || 0}</div>
                    </div>
                  ))}
                </div>

                {/* Roster */}
                <div className="grid grid-cols-2 gap-2">
                  {assignPlayersToRosterSlots(selectedTeamData.roster).map((slot) => (
                    <div
                      key={slot.id}
                      className={`rounded-lg p-2 border ${
                        slot.player
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200 border-dashed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-10 text-xs font-bold ${
                          slot.player ? 'text-green-700' : 'text-gray-400'
                        }`}>
                          {slot.label}
                        </div>
                        {slot.player ? (
                          <>
                            {slot.player.headshot ? (
                              <img
                                src={slot.player.headshot}
                                alt={slot.player.name}
                                className="w-8 h-8 rounded-full object-cover bg-gray-200 flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-xs font-bold flex-shrink-0">
                                {slot.player.position}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900 truncate">{slot.player.name}</div>
                              <div className="text-[10px] text-gray-600">
                                {slot.player.position} · {slot.player.team} · ADP {slot.player.adp.toFixed(1)}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 flex-shrink-0">
                              {slot.player.projectedPoints?.toFixed(1) || '-'}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-400 italic">
                            Empty
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-12">
                Select a team to view their roster
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
