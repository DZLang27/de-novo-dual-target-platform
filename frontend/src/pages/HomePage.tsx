import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeroNGL from '../components/landing/HeroNGL'

const styles = `
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;padding:0}

@keyframes fadeInUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}

.animate-fade{animation:fadeInUp .6s ease-out forwards;opacity:0}
.animate-fade-d1{animation-delay:.1s}
.animate-fade-d2{animation-delay:.2s}
.animate-fade-d3{animation-delay:.3s}
.animate-fade-d4{animation-delay:.4s}
.animate-float{animation:float 3s ease-in-out infinite}

.landing-card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.02);border:1px solid #f1f5f9;transition:all .3s ease}
.landing-card:hover{box-shadow:0 8px 30px rgba(0,0,0,.06);border-color:#e0e7ff}
`

const advantages = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    iconBg: '#fef2f2',
    title: '从临床问题出发',
    description: '面向 EGFR-T790M/C797S 奥希替尼耐药这一真实临床困局，而非泛泛的通用分子生成框架。每个设计决策都有临床机制支撑。',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4c6ef5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" /><path d="M10 22V2l4 4v16" />
      </svg>
    ),
    iconBg: '#eef2ff',
    title: '聚类 + 策略输出',
    description: '通过聚类算法对高分分子进行分组，将AI黑箱决策转化为"高EGFR亲和路线""平衡双靶点路线"等直观的设计策略。',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16" /><path d="M10 22V2l4 4v16" />
      </svg>
    ),
    iconBg: '#ecfdf5',
    title: '合成可及性约束',
    description: 'SA Score写进生成阶段评价函数，从源头避免"好看但造不出来"的分子。实现"AI提出方案、专家指导合成"的协同模式。',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    iconBg: '#fffbeb',
    title: '双靶点协同优化',
    description: '同时优化主靶点与辅助靶点的结合亲和力，通过多维度评价函数在亲和力、类药性和合成可及性之间找到最优平衡。',
  },
]

const workflowSteps = [
  {
    step: 1,
    title: '设计配置',
    subtitle: 'Configure',
    description: '输入主靶点（如EGFR T790M/C797S）和辅助靶点（如c-MET），上传PDB结构文件，配置生成数量、搜索策略和评价函数权重。',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4c6ef5" strokeWidth="2">
        <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
    tags: ['EGFR', 'c-MET', '10个分子'],
  },
  {
    step: 2,
    title: '分子从头设计',
    subtitle: 'Generate',
    description: 'REINVENT4 引擎在强化学习框架下执行双靶点协同生成。多维度评价函数同时优化结合亲和力、类药性和合成可及性。',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4c6ef5" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    tags: ['REINVENT4', '强化学习'],
  },
  {
    step: 3,
    title: '多维分析优化',
    subtitle: 'Analyze',
    description: '聚类分析提取设计模式，ADMET雷达图评估成药性，SAR横向对比分子差异，MPO多参数优化找到帕累托最优解。',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4c6ef5" strokeWidth="2">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><line x1="18" y1="12" x2="18" y2="17" />
      </svg>
    ),
    tags: ['聚类', 'ADMET', 'SAR', 'MPO'],
  },
  {
    step: 4,
    title: '结构表征可视化',
    subtitle: 'Visualize',
    description: 'RDKit渲染2D分子结构，NGL Viewer展示3D蛋白-配体复合物。分析结合模式（氢键、疏水作用、π-π堆积），确认双靶点协同结合的分子机制。',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4c6ef5" strokeWidth="2">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" />
      </svg>
    ),
    tags: ['RDKit 2D', 'NGL 3D'],
  },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: "'Inter','Noto Sans SC','system-ui','sans-serif'", background: '#f8f9fc', color: '#1e293b', minHeight: '100vh', width: '100%' }}>
      <style>{styles}</style>

      {/* ════════════════════════════════════════ */}
      {/* HERO */}
      {/* ════════════════════════════════════════ */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        background: 'linear-gradient(135deg,#0c1222 0%,#1a103c 50%,#2d1b69 100%)',
        overflow: 'hidden',
      }}>
        {/* Particle background */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4 }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: Math.random() * 200 + 80,
              height: Math.random() * 200 + 80,
              borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${Math.random() * 6 + 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }} />
          ))}
        </div>

        {/* Navigation */}
        <nav style={{
          position: 'relative', zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 40px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(79,70,229,.3)',
            }}>
              <svg width="16" height="18" viewBox="0 0 448 512" fill="#fff">
                <path d="M416 0c17.7 0 32 14.3 32 32c0 59.8-30.3 107.5-69.4 146.6c-28 28-62.5 53.5-97.3 77.4l-2.5 1.7c-11.9 8.1-23.8 16.1-35.5 23.9l-1.6 1c-6 4-11.9 7.9-17.8 11.9c-20.9 14-40.8 27.7-59.3 41.5l118.5 0c-9.8-7.4-20.1-14.7-30.7-22.1l7-4.7 3-2c15.1-10.1 30.9-20.6 46.7-31.6c25 18.1 48.9 37.3 69.4 57.7C417.7 372.5 448 420.2 448 480c0 17.7-14.3 32-32 32s-32-14.3-32-32L64 480c0 17.7-14.3 32-32 32s-32-14.3-32-32c0-59.8 30.3-107.5 69.4-146.6c28-28 62.5-53.5 97.3-77.4c-34.8-23.9-69.3-49.3-97.3-77.4C30.3 139.5 0 91.8 0 32C0 14.3 14.3 0 32 0S64 14.3 64 32l320 0c0-17.7 14.3-32 32-32zM338.6 384l-229.2 0c-10.1 10.6-18.6 21.3-25.5 32l280.2 0c-6.8-10.7-15.3-21.4-25.5-32zM109.4 128l229.2 0c10.1-10.7 18.6-21.3 25.5-32L83.9 96c6.8 10.7 15.3 21.3 25.5 32zm55.4 48c18.4 13.8 38.4 27.5 59.3 41.5c20.9-14 40.8-27.7 59.3-41.5l-118.5 0z"/>
              </svg>
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>De Nove</div>
              <div style={{ color: '#a5b4fc', fontSize: 10 }}>AI-Driven Dual-Target Drug Design</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ApiStatusIndicator />
            <button onClick={() => navigate('/dashboard')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10,
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color: '#fff', fontSize: 12, fontWeight: 600, border: 'none',
              cursor: 'pointer', transition: 'all .2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(79,70,229,.3)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              进入平台
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </div>
        </nav>

        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'row' as any, alignItems: 'center',
          gap: 32, padding: '16px 40px 64px',
          minHeight: 'calc(100vh - 72px)',
          flexWrap: 'wrap' as any,
        }}>
          {/* Left */}
          <div style={{ flex: 1, maxWidth: 576 }}>
            <div className="animate-fade">
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.08)',
                marginBottom: 24,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                  面向 EGFR-T790M/C797S + c-MET 耐药的新一代药物设计范式
                </span>
              </div>

              <h1 style={{
                fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700,
                color: '#fff', lineHeight: 1.15, marginBottom: 16,
                letterSpacing: '-0.02em',
              }}>
                从临床耐药困境<br />
                到<span style={{
                  background: 'linear-gradient(135deg,#818cf8,#a78bfa)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>智能分子设计</span>
              </h1>

              <p style={{
                color: '#c7d2fe', fontSize: 16, lineHeight: 1.8, marginBottom: 24,
              }}>
                基于 REINVENT4 强化学习引擎，集成双靶点结合能、类药性及合成可及性的多维度评价函数。
                通过聚类分析与结合模式提取，将AI黑箱决策转化为可解释的多靶点联合设计策略。
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap' as any, gap: 12, marginBottom: 32 }}>
                <button onClick={() => document.getElementById('advantages')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 24px', borderRadius: 10,
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    color: '#fff', fontSize: 13, fontWeight: 600, border: 'none',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(79,70,229,.3)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                  了解核心优势
                </button>
                <button onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 24px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    transition: 'all .2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  工作流程
                </button>
              </div>

              <div style={{ display: 'flex', gap: 32 }}>
                {[
                  { value: '4', unit: '步', label: '递进工作流' },
                  { value: '12', unit: '维', label: 'ADMET评估' },
                  { value: '3', unit: '重', label: '评分组件约束' },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                      {s.value}<span style={{ fontSize: 16, color: '#818cf8' }}>{s.unit}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#a5b4fc', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: 3D */}
          <div style={{ flex: 1, width: '100%', maxWidth: 672 }} className="animate-fade animate-fade-d2">
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', inset: -16,
                background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))',
                borderRadius: 24, filter: 'blur(40px)',
              }} />
              <div style={{
                position: 'relative',
                background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(12px)',
                borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(248,113,113,0.8)' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(251,191,36,0.8)' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(52,211,153,0.8)' }} />
                  </div>
                  <span style={{ color: '#a5b4fc', fontSize: 12, fontFamily: 'monospace' }}>EGFR T790M/C797S</span>
                  <span style={{ color: '#64748b', fontSize: 10 }}>拖拽旋转 · 滚轮缩放</span>
                </div>
                <div style={{ height: 420, background: '#0a0e1a', position: 'relative' }}>
                  <HeroNGL pdbId="6LUD" />
                  <div style={{
                    position: 'absolute', bottom: 16, left: 16,
                    padding: '8px 14px', borderRadius: 8,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>EGFR 突变激酶域 (PDB: 6LUD)</div>
                    <div style={{ color: '#a5b4fc', fontSize: 10 }}>C797S 突变位点 <span style={{ color: '#f87171' }}>●</span> 奥希替尼耐药关键</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
        }} className="animate-float">
          <button onClick={() => document.getElementById('advantages')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              display: 'flex', flexDirection: 'column' as any, alignItems: 'center', gap: 4,
              color: '#64748b', background: 'none', border: 'none', cursor: 'pointer',
              transition: 'color .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b' }}
          >
            <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as any }}>向下滚动</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>
      </section>

      {/* ════════════════════════════════════════ */}
      {/* ADVANTAGES */}
      {/* ════════════════════════════════════════ */}
      <section id="advantages" style={{ padding: '100px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }} className="animate-fade">
            <p style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as any,
              letterSpacing: '2px', color: '#4f46e5', marginBottom: 12,
            }}>
              Why De Nove
            </p>
            <h2 style={{ fontSize: 32, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
              核心差异化优势
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, maxWidth: 576, margin: '0 auto', lineHeight: 1.7 }}>
              不同于传统单一分子生成工具，我们从临床耐药问题出发，将AI计算结果转化为可执行的药物设计策略
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 24,
          }}>
            {advantages.map((item, index) => (
              <div key={index} className={`animate-fade animate-fade-d${index + 1}`}>
                <div className="landing-card" style={{ height: '100%' } as any}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: item.iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                  }}>
                    {item.icon}
                  </div>
                  <h3 style={{ fontWeight: 600, color: '#0f172a', fontSize: 15, marginBottom: 8 }}>
                    {item.title}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.8 }}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════ */}
      {/* WORKFLOW */}
      {/* ════════════════════════════════════════ */}
      <section id="workflow" style={{
        padding: '100px 40px',
        background: 'linear-gradient(180deg,#f8fafc 0%,#fff 100%)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }} className="animate-fade">
            <p style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as any,
              letterSpacing: '2px', color: '#4f46e5', marginBottom: 12,
            }}>
              Workflow
            </p>
            <h2 style={{ fontSize: 32, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
              四步递进工作流
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, maxWidth: 512, margin: '0 auto' }}>
              像向导一样引导您完成从靶点配置到设计策略输出的全过程
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' as any, gap: 24 }}>
            {workflowSteps.map((step, index) => (
              <div key={index}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}
                  className={`animate-fade animate-fade-d${index + 1}`}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 16,
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                  }}>
                    {step.step}
                  </div>
                  <div className="landing-card" style={{
                    flex: 1, display: 'flex', flexDirection: 'row' as any,
                    gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' as any,
                  } as any}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ color: '#4f46e5', display: 'flex' }}>{step.icon}</span>
                        <h3 style={{ fontWeight: 600, color: '#0f172a' }}>{step.title}</h3>
                        <span style={{
                          padding: '2px 10px', borderRadius: 999,
                          background: '#eef2ff', color: '#4f46e5',
                          fontSize: 10, fontWeight: 500,
                        }}>
                          {step.subtitle}
                        </span>
                      </div>
                      <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.8 }}>
                        {step.description}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' as any }}>
                      {step.tags.map((tag, i) => (
                        <span key={i} style={{
                          padding: '6px 12px', borderRadius: 8,
                          background: '#f8fafc', border: '1px solid #e2e8f0',
                          color: '#64748b', fontSize: 11,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {index < workflowSteps.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <button onClick={() => navigate('/dashboard')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 32px', borderRadius: 10,
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                color: '#fff', fontSize: 15, fontWeight: 600, border: 'none',
                cursor: 'pointer', transition: 'all .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(79,70,229,.3)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16"/><path d="M10 22V2l4 4v16"/></svg>
              开始分子设计
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ════════════════════════════════════════ */}
      <footer style={{
        background: '#0f172a', color: '#fff',
        padding: '40px 40px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{
          maxWidth: 1152, margin: '0 auto',
          display: 'flex', flexDirection: 'row' as any,
          alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap' as any, gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 2a4 4 0 0 0-4 4v2h8V6a4 4 0 0 0-4-4z"/><path d="M9 12h6"/><path d="M12 12v6"/><path d="M6 18h12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>De Nove 智药</div>
              <div style={{ fontSize: 10, color: '#475569' }}>华中科技大学 · 双靶点AI药物研发项目组</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#334155' }}>
            REINVENT4 · DockStream · RDKit.js · NGL Viewer · FastAPI
          </div>
        </div>
      </footer>
    </div>
  )
}

function ApiStatusIndicator() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then(r => r.json())
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'))
  }, [])

  const colorMap = { loading: '#fbbf24', ok: '#34d399', error: '#f87171' }
  const textMap = { loading: 'API检测中', ok: 'API正常', error: 'API离线' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 8,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorMap[status] }} />
      <span style={{ color: '#a5b4fc', fontSize: 12 }}>{textMap[status]}</span>
    </div>
  )
}
