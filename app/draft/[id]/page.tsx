'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDraftStore } from '@/store/draft-store';
import { Player, DraftPick } from '@/lib/types';
import { Dropdown } from '@/components/ui/dropdown';
import { Logo } from '@/components/ui/logo';

// Define roster slot structure
interface RosterSlot {
  id: string;
  label: string;
  position: string | string[]; // single position or array for FLEX/BENCH
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

  // Track assigned players
  const assignedPlayerIds = new Set<string>();

  // First pass: assign to primary position slots
  for (const player of roster) {
    for (const slot of slots) {
      if (slot.player) continue; // slot already filled
      if (assignedPlayerIds.has(player.id)) continue; // player already assigned

      const isMatch = Array.isArray(slot.position)
        ? false // skip flex/bench in first pass
        : slot.position === player.position;

      if (isMatch) {
        slot.player = player;
        assignedPlayerIds.add(player.id);
        break;
      }
    }
  }

  // Second pass: assign remaining players to FLEX
  for (const player of roster) {
    if (assignedPlayerIds.has(player.id)) continue;

    const flexSlot = slots.find(s => s.id === 'flex' && !s.player);
    if (flexSlot && ['RB', 'WR', 'TE'].includes(player.position)) {
      flexSlot.player = player;
      assignedPlayerIds.add(player.id);
    }
  }

  // Third pass: assign remaining players to bench
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

export default function DraftPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.id as string;

  const {
    setDraft,
    makePick,
    getCurrentTeam,
    getCurrentRound,
    getPickNumber,
    isUserTurn,
    availablePlayers,
    picks,
    teams,
    status,
  } = useDraftStore();

  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [aiPicking, setAiPicking] = useState(false);

  const currentTeam = getCurrentTeam();
  const currentRound = getCurrentRound();
  const pickNumber = getPickNumber();
  const isMyTurn = isUserTurn();

  // Load draft on mount
  useEffect(() => {
    loadDraft();
  }, [draftId]);

  // Redirect to summary when draft is completed
  useEffect(() => {
    if (status === 'completed' && !loading) {
      router.push(`/draft/${draftId}/summary`);
    }
  }, [status, loading, draftId, router]);

  // Auto-trigger AI picks
  useEffect(() => {
    if (status === 'in_progress' && currentTeam && !currentTeam.isUser && !aiPicking) {
      triggerAIPick();
    }
  }, [currentTeam, status]);

  const loadDraft = async () => {
    try {
      const response = await fetch(`/api/draft/${draftId}`);
      const data = await response.json();

      if (data.success) {
        setDraft(data.data);
      } else {
        alert('Draft not found');
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      alert('Failed to load draft');
    } finally {
      setLoading(false);
    }
  };

  const triggerAIPick = async () => {
    if (!currentTeam || currentTeam.isUser) return;

    setAiPicking(true);

    try {
      const response = await fetch('/api/ai-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          teamId: currentTeam.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDraft(data.data.draft);
      }
    } catch (error) {
      console.error('Error making AI pick:', error);
    } finally {
      setAiPicking(false);
    }
  };

  const handleUserPick = async (player: Player) => {
    if (!isMyTurn || !currentTeam) return;

    try {
      const response = await fetch('/api/draft/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          teamId: currentTeam.id,
          playerId: player.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDraft(data.data);
        setSelectedPlayer(null);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error making pick:', error);
      alert('Failed to make pick');
    }
  };

  // Filter players
  const filteredPlayers = availablePlayers.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition = positionFilter === 'ALL' || player.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-900 text-xl">Loading draft...</div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Draft Complete!</h1>
          <p className="text-gray-600 mb-8">Redirecting to summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Round {currentRound} - Pick {pickNumber}
              </p>
              {currentTeam && (
                <div className="text-lg font-semibold text-gray-900">
                  {isMyTurn ? '🟢 YOUR PICK' : `⏳ ${currentTeam.name} picking...`}
                </div>
              )}
            </div>
            <Logo size="md" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Available Players */}
          <div className="col-span-5 bg-white rounded-xl p-5 border border-gray-200 shadow-sm max-h-[calc(100vh-180px)] overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Available Players</h2>

            {/* Search & Filter */}
            <div className="mb-4 space-y-2">
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <Dropdown
                options={[
                  { value: 'ALL', label: 'All Positions' },
                  { value: 'QB', label: 'QB' },
                  { value: 'RB', label: 'RB' },
                  { value: 'WR', label: 'WR' },
                  { value: 'TE', label: 'TE' },
                  { value: 'K', label: 'K' },
                  { value: 'DEF', label: 'DEF' }
                ]}
                value={positionFilter}
                onChange={setPositionFilter}
              />
            </div>

            {/* Player List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredPlayers.slice(0, 100).map((player, index) => (
                <button
                  key={player.id}
                  onClick={() => isMyTurn && setSelectedPlayer(player)}
                  disabled={!isMyTurn}
                  className={`w-full text-left p-3 rounded-lg transition-all border ${
                    selectedPlayer?.id === player.id
                      ? 'bg-blue-50 border-blue-500 shadow-sm'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  } ${!isMyTurn && 'opacity-50 cursor-not-allowed'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {player.headshot ? (
                        <img
                          src={player.headshot}
                          alt={player.name}
                          className="w-10 h-10 rounded-full object-cover bg-gray-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-sm font-bold">
                          {player.position}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">{player.name}</div>
                        <div className="text-xs text-gray-600">
                          {player.team} · {player.position} · ADP: {player.adp.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      #{index + 1}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Draft Button */}
            {isMyTurn && selectedPlayer && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleUserPick(selectedPlayer)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  Draft {selectedPlayer.name}
                </button>
              </div>
            )}
          </div>

          {/* Center: Recent Picks */}
          <div className="col-span-4 bg-white rounded-xl p-5 border border-gray-200 shadow-sm max-h-[calc(100vh-180px)] overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Picks</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {picks.slice().reverse().map((pick) => {
                const player = [...availablePlayers, ...teams.flatMap(t => t.roster)].find(p => p.id === pick.playerId);
                const team = teams.find(t => t.id === pick.teamId);

                return (
                  <div
                    key={pick.id}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      {player?.headshot ? (
                        <img
                          src={player.headshot}
                          alt={player.name}
                          className="w-8 h-8 rounded-full object-cover bg-gray-200 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-xs font-bold flex-shrink-0">
                          {player?.position}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500">
                          {pick.round}.{pick.pickInRound} · {team?.name}
                        </div>
                        <div className="font-semibold text-gray-900 truncate">{player?.name}</div>
                        <div className="text-xs text-gray-600">
                          {player?.position} · {player?.team}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 flex-shrink-0">
                        #{pick.pickNumber}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Team Rosters */}
          <div className="col-span-3 bg-white rounded-xl p-5 border border-gray-200 shadow-sm max-h-[calc(100vh-180px)] overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your Team</h2>
            <div className="flex-1 overflow-y-auto space-y-1">
              {assignPlayersToRosterSlots(teams.find(t => t.isUser)?.roster || []).map((slot) => (
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
                            className="w-7 h-7 rounded-full object-cover bg-gray-200 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-[10px] font-bold flex-shrink-0">
                            {slot.player.position}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">{slot.player.name}</div>
                          <div className="text-[10px] text-gray-600">
                            {slot.player.position} · {slot.player.team}
                          </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
