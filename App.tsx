import React, { useState, useEffect } from 'react';
import GameLoop from './components/GameLoop';
import { GameState, GameMetrics } from './types';
import * as C from './constants';
import { Sword, Shield, Skull, Trophy, RefreshCw, Check, Play, User } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [metrics, setMetrics] = useState<GameMetrics>({
    p1Health: 100,
    p2Health: 100,
    score: 0,
    wave: 1
  });

  // Color Selection State
  const [p1Color, setP1Color] = useState(C.PLAYER_COLOR_OPTIONS[0]); // Default Blue
  const [p2Color, setP2Color] = useState(C.PLAYER_COLOR_OPTIONS[1]); // Default Red

  // Cutscene State
  const [cutsceneStep, setCutsceneStep] = useState(0);

  // Calculate percentage for health bars
  const p1HpPercent = Math.max(0, (metrics.p1Health / 100) * 100);
  const p2HpPercent = Math.max(0, (metrics.p2Health / 100) * 100);
  const bossHpPercent = metrics.maxBossHp ? Math.max(0, (metrics.bossHp! / metrics.maxBossHp) * 100) : 0;

  const startCutscene = () => {
    setGameState(GameState.INTRO_CUTSCENE);
    setCutsceneStep(0);
  };

  const skipCutscene = () => {
     // Reset metrics
    setMetrics({ p1Health: 100, p2Health: 100, score: 0, wave: 1 });
    setGameState(GameState.PLAYING);
  }

  // Auto-advance cutscene
  useEffect(() => {
    if (gameState === GameState.INTRO_CUTSCENE) {
      const timer = setTimeout(() => {
        if (cutsceneStep < 2) {
          setCutsceneStep(prev => prev + 1);
        } else {
          skipCutscene();
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState, cutsceneStep]);

  return (
    <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans text-white">
      
      {/* HUD - Always visible during gameplay */}
      {gameState === GameState.PLAYING && (
        <div className="w-full px-8 flex flex-col items-center absolute top-4 z-10 pointer-events-none">
          <div className="w-full flex justify-between items-start">
            {/* Player 1 Stats */}
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2 bg-slate-900/80 p-3 rounded-lg backdrop-blur-sm border border-slate-700 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <div className="p-2 rounded-full border-2 border-slate-600" style={{ backgroundColor: p1Color }}>
                  <Shield size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-sm" style={{ color: p1Color }}>PLAYER 1</h2>
                  <div className="w-48 h-4 bg-slate-800 rounded-full mt-1 overflow-hidden border border-slate-600">
                    <div 
                      className="h-full transition-all duration-200" 
                      style={{ width: `${p1HpPercent}%`, backgroundColor: p1Color }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Score Board */}
            <div className="flex flex-col items-center bg-slate-900/90 px-8 py-3 rounded-xl border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.2)] backdrop-blur-sm transform translate-y-2">
               <div className="flex items-center gap-2 text-yellow-400 font-black text-3xl font-mono tracking-tighter">
                 <Trophy size={28} />
                 <span>{metrics.score.toString().padStart(3, '0')}</span>
               </div>
               <span className="text-[10px] text-slate-500 tracking-[0.2em] uppercase font-bold mt-1">Kills</span>
            </div>

            {/* Player 2 Stats */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-col items-end gap-2 bg-slate-900/80 p-3 rounded-lg backdrop-blur-sm border border-slate-700 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2">
                   <div className="text-right">
                    <h2 className="font-bold text-sm" style={{ color: p2Color }}>PLAYER 2</h2>
                   </div>
                   <div className="p-2 rounded-full border-2 border-slate-600" style={{ backgroundColor: p2Color }}>
                    <Sword size={24} className="text-white" />
                  </div>
                </div>
                <div className="w-48 h-4 bg-slate-800 rounded-full mt-1 overflow-hidden border border-slate-600">
                    <div 
                      className="h-full transition-all duration-200" 
                      style={{ width: `${p2HpPercent}%`, backgroundColor: p2Color }}
                    />
                </div>
              </div>
            </div>
          </div>
          
          {/* BOSS BAR */}
          {metrics.bossHp !== undefined && metrics.maxBossHp !== undefined && (
            <div className="mt-8 w-2/3 max-w-4xl flex flex-col items-center pointer-events-auto transition-all duration-500 ease-out transform translate-y-0 opacity-100">
               <h3 className="text-red-500 font-black text-3xl tracking-[0.5em] mb-2 uppercase drop-shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-pulse">The Guardian</h3>
               <div className="w-full h-10 bg-slate-950 rounded-lg border-2 border-red-900 overflow-hidden relative shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                  {/* Background Grid Pattern for effect */}
                  <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.3)_25%,rgba(255,0,0,0.3)_50%,transparent_50%,transparent_75%,rgba(255,0,0,0.3)_75%,rgba(255,0,0,0.3)_100%)] bg-[length:20px_20px]"></div>
                  
                  <div 
                    className="h-full bg-gradient-to-r from-red-900 via-red-600 to-red-500 transition-all duration-300 ease-out" 
                    style={{ width: `${bossHpPercent}%` }}
                  />
                  
                  {/* Numeric Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="text-white font-mono font-bold text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">
                       {Math.ceil(metrics.bossHp)} / {metrics.maxBossHp}
                    </span>
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {/* Main Game Container */}
      <div className="w-full h-full relative flex items-center justify-center p-4">
        <GameLoop 
          gameState={gameState} 
          setGameState={setGameState}
          onMetricsUpdate={setMetrics} 
          p1Color={p1Color}
          p2Color={p2Color}
        />

        {/* Start Menu Overlay */}
        {gameState === GameState.MENU && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-20">
            <h1 className="text-6xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 via-white to-red-400 mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] text-center tracking-tight">
              DUAL<br/>DEFENDER
            </h1>
            <p className="text-slate-400 text-lg mb-10 tracking-[0.5em] uppercase text-xs">Co-op Survival Platformer</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 max-w-5xl w-full px-8">
              {/* Player 1 Selection */}
              <div className="bg-slate-900/80 p-8 rounded-2xl border border-slate-700 flex flex-col items-center text-center backdrop-blur-md shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ backgroundColor: p1Color }}></div>
                <Shield size={48} style={{ color: p1Color }} className="mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                <h3 className="text-2xl font-bold text-white mb-1">Player 1</h3>
                <p className="text-slate-500 text-sm mb-6 uppercase tracking-wider">The Protector</p>
                
                <div className="flex gap-2 mb-6 flex-wrap justify-center">
                  {C.PLAYER_COLOR_OPTIONS.map(c => (
                    <button 
                      key={c}
                      onClick={() => setP1Color(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all transform hover:scale-110 ${p1Color === c ? 'border-white scale-110 shadow-[0_0_10px_white]' : 'border-transparent opacity-50 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="text-sm space-y-2 text-slate-300 bg-slate-950/50 p-4 rounded-lg w-full">
                  <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                    <span>Move</span>
                    <span className="font-bold text-white">WASD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parry</span>
                    <span className="font-bold text-white">SPACE</span>
                  </div>
                </div>
              </div>

              {/* Player 2 Selection */}
              <div className="bg-slate-900/80 p-8 rounded-2xl border border-slate-700 flex flex-col items-center text-center backdrop-blur-md shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ backgroundColor: p2Color }}></div>
                <Sword size={48} style={{ color: p2Color }} className="mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                <h3 className="text-2xl font-bold text-white mb-1">Player 2</h3>
                <p className="text-slate-500 text-sm mb-6 uppercase tracking-wider">The Warrior</p>

                <div className="flex gap-2 mb-6 flex-wrap justify-center">
                  {C.PLAYER_COLOR_OPTIONS.map(c => (
                    <button 
                      key={c}
                      onClick={() => setP2Color(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all transform hover:scale-110 ${p2Color === c ? 'border-white scale-110 shadow-[0_0_10px_white]' : 'border-transparent opacity-50 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="text-sm space-y-2 text-slate-300 bg-slate-950/50 p-4 rounded-lg w-full">
                  <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                    <span>Move</span>
                    <span className="font-bold text-white">ARROWS</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Attack</span>
                    <span className="font-bold text-white">ENTER</span>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={startCutscene}
              className="group relative flex items-center gap-4 px-16 py-6 bg-white text-black rounded-full font-black text-3xl hover:scale-110 transition-all shadow-[0_0_50px_rgba(255,255,255,0.4)] overflow-hidden tracking-widest animate-pulse hover:animate-none"
            >
               <Play size={32} fill="black" />
               START GAME
            </button>
          </div>
        )}

        {/* Intro Cutscene */}
        {gameState === GameState.INTRO_CUTSCENE && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-30 transition-opacity duration-1000">
             <div className="max-w-4xl text-center animate-pulse">
                <User size={120} className="mx-auto text-slate-600 mb-8" />
                {cutsceneStep === 0 && (
                  <h2 className="text-6xl font-black text-white tracking-tighter mb-4 typewriter">
                    "WARRIORS..."
                  </h2>
                )}
                {cutsceneStep === 1 && (
                  <h2 className="text-6xl font-black text-red-500 tracking-tighter mb-4 typewriter">
                    "BRING ME 100 SOULS."
                  </h2>
                )}
                {cutsceneStep >= 2 && (
                   <h2 className="text-6xl font-black text-white tracking-tighter mb-4 typewriter">
                    "THEN... FACE ME."
                   </h2>
                )}
             </div>
             <button onClick={skipCutscene} className="absolute bottom-10 text-slate-600 text-sm uppercase tracking-widest hover:text-white transition-colors">Skip Cinematic</button>
          </div>
        )}

        {/* Victory Overlay */}
        {gameState === GameState.VICTORY && (
          <div className="absolute inset-0 bg-yellow-900/90 flex flex-col items-center justify-center z-20 backdrop-blur-xl">
            <Trophy size={100} className="text-yellow-400 mb-6 drop-shadow-[0_0_30px_rgba(250,204,21,0.6)]" />
            <h2 className="text-8xl font-black text-white mb-4 drop-shadow-xl tracking-tighter">VICTORY</h2>
            <p className="text-yellow-200 text-2xl mb-12 uppercase tracking-[0.3em] font-bold">The Guardian has fallen</p>
            
            <button 
              onClick={startCutscene}
              className="flex items-center gap-3 px-10 py-4 bg-yellow-500 hover:bg-yellow-400 rounded-full font-bold text-xl transition-all shadow-[0_0_20px_rgba(234,179,8,0.4)] text-black"
            >
              <RefreshCw size={24} />
              PLAY AGAIN
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-20 backdrop-blur-xl">
            <Skull size={80} className="text-slate-800 mb-6 animate-pulse" />
            <h2 className="text-7xl font-black text-red-500 mb-4 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] tracking-tighter">DEFEAT</h2>
            <p className="text-slate-400 text-lg mb-12 uppercase tracking-[0.3em]">The defenses have been breached</p>
            
            <div className="flex flex-col items-center bg-slate-900 p-12 rounded-3xl border border-slate-800 mb-12 min-w-[350px] shadow-2xl relative">
              <div className="absolute -top-6 bg-yellow-500 text-black font-bold px-4 py-1 rounded-full text-xs uppercase tracking-widest shadow-lg">Final Score</div>
              <span className="text-8xl font-mono font-bold text-white drop-shadow-md">{metrics.score}</span>
              <span className="text-slate-600 text-xs mt-4">ENEMIES ELIMINATED</span>
            </div>

            <button 
              onClick={startCutscene}
              className="flex items-center gap-3 px-10 py-4 bg-slate-800 hover:bg-slate-700 rounded-full font-bold text-xl transition-all border border-slate-600 hover:border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] text-slate-200"
            >
              <RefreshCw size={24} />
              RESTART MISSION
            </button>
          </div>
        )}
      </div>

    </div>
  );
}