'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useDraftStore } from '@/store/draft-store';
import { Player, DraftPick } from '@/lib/types';

export default function DraftPage() {
  const params = useParams();
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading draft...</div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Draft Complete!</h1>
          <p className="text-slate-300 mb-8">All picks have been made</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
          >
            Start New Draft
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">DraftIQ</h1>
              <p className="text-sm text-slate-400">
                Round {currentRound} - Pick {pickNumber}
              </p>
            </div>
            <div className="text-right">
              {currentTeam && (
                <>
                  <div className="text-lg font-semibold">
                    {isMyTurn ? '🟢 YOUR PICK' : `⏳ ${currentTeam.name} picking...`}
                  </div>
                  <div className="text-sm text-slate-400">
                    {teams.find(t => t.isUser)?.roster.length || 0} / {teams[0]?.roster.length || 0} picks made
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Available Players */}
          <div className="col-span-5 bg-slate-800 rounded-lg p-4 border border-slate-700 max-h-[calc(100vh-180px)] overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold mb-4">Available Players</h2>

            {/* Search & Filter */}
            <div className="mb-4 space-y-2">
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-sm"
              />
              <div className="flex gap-1 flex-wrap">
                {['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setPositionFilter(pos)}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      positionFilter === pos
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Player List */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredPlayers.slice(0, 100).map((player, index) => (
                <button
                  key={player.id}
                  onClick={() => isMyTurn && setSelectedPlayer(player)}
                  disabled={!isMyTurn}
                  className={`w-full text-left p-3 rounded transition-colors ${
                    selectedPlayer?.id === player.id
                      ? 'bg-blue-600'
                      : 'bg-slate-700/50 hover:bg-slate-700'
                  } ${!isMyTurn && 'opacity-50 cursor-not-allowed'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{player.name}</div>
                      <div className="text-xs text-slate-400">
                        {player.team} · {player.position} · ADP: {player.adp.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      #{index + 1}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Draft Button */}
            {isMyTurn && selectedPlayer && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <button
                  onClick={() => handleUserPick(selectedPlayer)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg"
                >
                  Draft {selectedPlayer.name}
                </button>
              </div>
            )}
          </div>

          {/* Center: Recent Picks */}
          <div className="col-span-4 bg-slate-800 rounded-lg p-4 border border-slate-700 max-h-[calc(100vh-180px)] overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold mb-4">Recent Picks</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {picks.slice().reverse().map((pick) => {
                const player = [...availablePlayers, ...teams.flatMap(t => t.roster)].find(p => p.id === pick.playerId);
                const team = teams.find(t => t.id === pick.teamId);

                return (
                  <div
                    key={pick.id}
                    className="bg-slate-700/50 rounded p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-slate-400">
                          {pick.round}.{pick.pickInRound} · {team?.name}
                        </div>
                        <div className="font-semibold">{player?.name}</div>
                        <div className="text-xs text-slate-400">
                          {player?.position} · {player?.team}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400">
                        #{pick.pickNumber}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Team Rosters */}
          <div className="col-span-3 bg-slate-800 rounded-lg p-4 border border-slate-700 max-h-[calc(100vh-180px)] overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold mb-4">Your Team</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {teams.find(t => t.isUser)?.roster.map((player) => (
                <div
                  key={player.id}
                  className="bg-slate-700/50 rounded p-2"
                >
                  <div className="font-medium text-sm">{player.name}</div>
                  <div className="text-xs text-slate-400">
                    {player.position} · {player.team}
                  </div>
                </div>
              ))}
              {(!teams.find(t => t.isUser)?.roster.length) && (
                <div className="text-center text-slate-400 py-8">
                  No picks yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
