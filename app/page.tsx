'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DraftSettings } from '@/lib/types';
import { getAllAIProfiles } from '@/lib/ai/profiles';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [draftPosition, setDraftPosition] = useState(6);
  const [numTeams, setNumTeams] = useState(12);
  const [numRounds, setNumRounds] = useState(15);

  const aiProfiles = getAllAIProfiles();

  const handleStartDraft = async () => {
    if (!teamName.trim()) {
      alert('Please enter a team name');
      return;
    }

    setLoading(true);

    try {
      const settings: DraftSettings = {
        numTeams,
        numRounds,
        pickTimeLimit: 90,
        scoringType: 'ppr',
        rosterSlots: {
          QB: 1,
          RB: 2,
          WR: 2,
          TE: 1,
          FLEX: 1,
          K: 1,
          DEF: 1,
          BENCH: 6,
        },
      };

      const response = await fetch('/api/draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userTeamName: teamName,
          userDraftPosition: draftPosition,
          settings,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/draft/${data.data.id}`);
      } else {
        alert(`Error: ${data.error}`);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error creating draft:', error);
      alert('Failed to create draft');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              DraftIQ
            </h1>
            <p className="text-xl text-slate-300">
              NFL Mock Draft with Intelligent AI Opponents
            </p>
            <p className="text-sm text-slate-400 mt-2">
              AI drafts based on team needs, psychology, and real draft behavior
            </p>
          </div>

          {/* Setup Form */}
          <div className="bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6">
              Setup Your Draft
            </h2>

            {/* Team Name */}
            <div className="mb-6">
              <label className="block text-slate-300 font-medium mb-2">
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                placeholder="Enter your team name"
              />
            </div>

            {/* Draft Position */}
            <div className="mb-6">
              <label className="block text-slate-300 font-medium mb-2">
                Draft Position
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max={numTeams}
                  value={draftPosition}
                  onChange={(e) => setDraftPosition(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-2xl font-bold text-white w-12 text-center">
                  {draftPosition}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Pick #{draftPosition} of {numTeams}
              </p>
            </div>

            {/* Number of Teams */}
            <div className="mb-6">
              <label className="block text-slate-300 font-medium mb-2">
                Number of Teams
              </label>
              <select
                value={numTeams}
                onChange={(e) => {
                  const newNum = parseInt(e.target.value);
                  setNumTeams(newNum);
                  if (draftPosition > newNum) setDraftPosition(newNum);
                }}
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-blue-500"
              >
                <option value={8}>8 Teams</option>
                <option value={10}>10 Teams</option>
                <option value={12}>12 Teams</option>
                <option value={14}>14 Teams</option>
              </select>
            </div>

            {/* Number of Rounds */}
            <div className="mb-8">
              <label className="block text-slate-300 font-medium mb-2">
                Number of Rounds
              </label>
              <select
                value={numRounds}
                onChange={(e) => setNumRounds(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10 Rounds</option>
                <option value={15}>15 Rounds</option>
                <option value={16}>16 Rounds</option>
              </select>
            </div>

            {/* AI Opponents Info */}
            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-white mb-2">
                AI Opponent Profiles
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {aiProfiles.slice(0, 6).map((profile) => (
                  <div key={profile.id} className="text-slate-300">
                    <span className="font-medium">{profile.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Each AI has unique tendencies: risk tolerance, panic factor, bye-week awareness
              </p>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartDraft}
              disabled={loading || !teamName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-colors"
            >
              {loading ? 'Starting Draft...' : 'Start Draft'}
            </button>
          </div>

          {/* Features */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl mb-2">🧠</div>
              <div className="text-sm font-medium text-white">Smart AI</div>
              <div className="text-xs text-slate-400">Reacts to runs & tier breaks</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-sm font-medium text-white">Real Behavior</div>
              <div className="text-xs text-slate-400">Panic picks & favorite teams</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-sm font-medium text-white">Live Draft</div>
              <div className="text-xs text-slate-400">Snake draft with real data</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
