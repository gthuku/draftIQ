'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DraftSettings, SCORING_FORMATS, ScoringFormat } from '@/lib/types';
import { getAllAIProfiles } from '@/lib/ai/profiles';
import { Dropdown } from '@/components/ui/dropdown';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [draftPosition, setDraftPosition] = useState(6);
  const [numTeams, setNumTeams] = useState(12);
  const [numRounds, setNumRounds] = useState(15);
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>('ppr');

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
        scoringType: scoringFormat,
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-blue-600">
              DraftIQ
            </h1>
            <p className="text-sm text-gray-600">
              Intelligent NFL Mock Draft
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Practice Your Draft Strategy
            </h2>
            <p className="text-lg text-gray-600 mb-2">
              NFL Mock Draft with Intelligent AI Opponents
            </p>
            <p className="text-sm text-gray-500">
              AI opponents with unique tendencies, team needs analysis, and realistic draft behavior
            </p>
          </div>

          {/* Setup Form */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Setup Your Draft
            </h2>

            {/* Team Name */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2 text-sm">
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                placeholder="Enter your team name"
              />
            </div>

            {/* Draft Position */}
            <Dropdown
              label="Draft Position"
              options={Array.from({ length: numTeams }, (_, i) => ({
                value: (i + 1).toString(),
                label: `Pick #${i + 1}`,
                description: i === 0 ? 'First overall pick' : i === numTeams - 1 ? 'Last pick in round' : undefined
              }))}
              value={draftPosition.toString()}
              onChange={(value) => setDraftPosition(parseInt(value))}
              className="mb-6"
            />

            {/* Scoring Format */}
            <Dropdown
              label="Scoring Format"
              options={SCORING_FORMATS.map(format => ({
                value: format.value,
                label: format.label,
                description: format.description
              }))}
              value={scoringFormat}
              onChange={(value) => setScoringFormat(value as ScoringFormat)}
              className="mb-6"
            />

            {/* Number of Teams */}
            <Dropdown
              label="Number of Teams"
              options={[
                { value: '8', label: '8 Teams' },
                { value: '10', label: '10 Teams' },
                { value: '12', label: '12 Teams' },
                { value: '14', label: '14 Teams' }
              ]}
              value={numTeams.toString()}
              onChange={(value) => {
                const newNum = parseInt(value);
                setNumTeams(newNum);
                if (draftPosition > newNum) setDraftPosition(newNum);
              }}
              className="mb-6"
            />

            {/* Number of Rounds */}
            <Dropdown
              label="Number of Rounds"
              options={[
                { value: '10', label: '10 Rounds' },
                { value: '15', label: '15 Rounds' },
                { value: '16', label: '16 Rounds' }
              ]}
              value={numRounds.toString()}
              onChange={(value) => setNumRounds(parseInt(value))}
              className="mb-8"
            />

            {/* AI Opponents Info */}
            <div className="bg-blue-50 rounded-lg p-5 mb-6 border border-blue-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                AI Opponent Profiles
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {aiProfiles.slice(0, 6).map((profile) => (
                  <div key={profile.id} className="text-gray-700 bg-white rounded px-2 py-1 border border-gray-200">
                    <span className="font-medium">{profile.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">
                Each AI has unique tendencies: risk tolerance, panic factor, bye-week awareness
              </p>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartDraft}
              disabled={loading || !teamName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              {loading ? 'Starting Draft...' : 'Start Draft'}
            </button>
          </div>

          {/* Features */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl mb-3">🧠</div>
              <div className="text-base font-semibold text-gray-900 mb-1">Smart AI</div>
              <div className="text-sm text-gray-600">Reacts to runs & tier breaks</div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl mb-3">📊</div>
              <div className="text-base font-semibold text-gray-900 mb-1">Real Behavior</div>
              <div className="text-sm text-gray-600">Panic picks & favorite teams</div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl mb-3">⚡</div>
              <div className="text-base font-semibold text-gray-900 mb-1">Live Draft</div>
              <div className="text-sm text-gray-600">Snake draft with real data</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
