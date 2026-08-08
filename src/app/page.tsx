import Link from "next/link";

import { api, HydrateClient } from "~/trpc/server";
import { auth } from "~/server/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    void api.sensor.getLatest.prefetch({ limit: 5 });
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background Pattern Overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOFYwYzkuOTQgMCAxOCA4LjA2IDE4IDE4aDkuOTRjMC05Ljk0LTguMDYtMTgtMTgtMTh2OWMwLTkuOTQtOC4wNi0xOC0xOC0xOHY5QzkuOTQgMCAwIDguMDYgMCAxOGg5Yy05Ljk0IDAtMTggOC4wNi0xOCAxOGg5Yy05Ljk0IDAtMTggOC4wNi0xOCAxOGg5YzAtOS45NC04LjA2LTE4LTE4LTE4djloMThtOS0xOGMwIDkuOTQgOC4wNiAxOCAxOCAxOHY5Yy05Ljk0IDAtMTgtOC4wNi0xOC0xOGgtOW02MyAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOHY5YzAgOS45NCA4LjA2IDE4IDE4IDE4aDlNMjcgMzZoOW0wIDBjMC05Ljk0LTguMDYtMTgtMTgtMTh2OWMwIDkuOTQgOC4wNiAxOCAxOCAxOHY5bTAtMThjMCAwIDAgMCAwIDBtLTE4IDloOWMwIDAgMCAwIDAgMG0wIDl2OW0wLTljMCAwIDAgMCAwIDBtOS05aDltLTktOTloOSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iLjA1IiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1IiBjeD0iMTguNSIgY3k9IjE4LjUiIHI9IjEuNSIvPjxjaXJjbGUgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuMDUiIGN4PSIyNy41IiBjeT0iMjcuNSIgcj0iMS41Ii8+PGNpcmNsZSBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii4wNSIgY3g9IjkuNSIgY3k9IjI3LjUiIHI9IjEuNSIvPjxjaXJjbGUgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuMDUiIGN4PSIyNy41IiBjeT0iOS41IiByPSIxLjUiLz48Y2lyY2xlIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1IiBjeD0iNDUuNSIgY3k9IjI3LjUiIHI9IjEuNSIvPjwvZz48L3N2Zz4=')] opacity-40 mix-blend-overlay" />

          <div className="container mx-auto px-4 py-32 relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="lg:w-1/2 space-y-8">
                <div>
                  <span className="inline-block px-4 py-2 rounded-full bg-blue-500/20 text-blue-300 text-sm font-semibold mb-6">
                    The smart monitor that knows exactly how dirty your filter is
                  </span>
                  <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
                    Replace your HVAC filter{" "}
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                      only once you need to
                    </span>
                  </h1>
                  <p className="text-xl text-gray-300 mb-6 max-w-2xl">
                    The smart filter monitor measures exactly how dirty your filter
                    is — not by the calendar, but by the airflow it&apos;s actually
                    blocking. As it clogs, your HVAC burns extra electricity every
                    hour it runs. The moment that wasted energy starts costing you
                    more than a fresh filter, we automatically send you a new one.
                    No guessing, no reminders, no wasted filters.
                  </p>
                  <p className="text-sm text-gray-500 mb-8 max-w-2xl">
                    &ldquo;How often should I really change my filter?&rdquo; Even
                    the experts answer &ldquo;it depends&rdquo; —{" "}
                    <a
                      href="https://www.waltonemc.com/blog/how-often-do-i-really-have-to-change-my-hvac-filter/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                    >
                      see this utility-company explainer
                    </a>
                    . Your monitor replaces &ldquo;it depends&rdquo; with a
                    measurement.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  {session ? (
                    <Link
                      href="/dashboard"
                      className="px-8 py-4 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium text-center transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                    >
                      <span>Go to Dashboard</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  ) : (
                    <Link
                      href="/api/auth/signin"
                      className="px-8 py-4 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium text-center transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                    >
                      <span>Sign In</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  )}
                  <a
                    href="#how-it-works"
                    className="px-8 py-4 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-center transition-all border border-white/10"
                  >
                    Learn More
                  </a>
                </div>
                
                {session?.user && (
                  <p className="text-gray-400">
                    Welcome back, <span className="text-blue-400">{session.user.name ?? session.user.email}</span>!
                  </p>
                )}
              </div>

              <div className="lg:w-1/2 relative">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 opacity-20 blur-lg"></div>
                <div className="relative bg-gray-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                  <div className="p-1">
                    <div className="bg-black/30 rounded-xl p-2">
                      <div className="flex items-center gap-1.5 pb-2 px-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <div className="text-xs text-gray-400 ml-2">Smart Filter Dashboard</div>
                      </div>
                      
                      <div className="bg-gray-800 rounded-lg p-4 h-72 overflow-hidden relative">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-700/50 rounded-lg p-4 border border-white/5">
                            <div className="text-xs text-gray-400">Differential Pressure</div>
                            <div className="text-2xl font-bold text-white">125.3 Pa</div>
                            <div className="mt-2 h-1 bg-gray-600 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 w-3/4" />
                            </div>
                          </div>
                          <div className="bg-gray-700/50 rounded-lg p-4 border border-white/5">
                            <div className="text-xs text-gray-400">Temperature</div>
                            <div className="text-2xl font-bold text-white">24.3 °C</div>
                            <div className="mt-2 h-1 bg-gray-600 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-orange-400 to-red-400 w-2/3" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4 bg-gray-700/50 rounded-lg p-4 border border-white/5">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-xs text-gray-400">Filter Life Remaining</div>
                            <div className="text-xs text-blue-400">75%</div>
                          </div>
                          <div className="h-24 flex items-end gap-1">
                            {[40, 25, 35, 30, 35, 55, 25, 30, 45, 65, 40, 30, 25, 35, 60, 75, 45, 35, 50, 40]?.map((h, i) => (
                              <div 
                                key={i}
                                className="h-full flex-1 group relative"
                              >
                                <div 
                                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-sm transition-all duration-200"
                                  style={{ height: `${h}%` }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="absolute top-2 right-2 bg-green-500/20 rounded-full px-2 py-0.5 text-xs text-green-400 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          Connected
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics/Stats */}
            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="text-4xl font-bold text-white mb-1">24/7</div>
                <div className="text-gray-400">Monitoring</div>
              </div>
              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="text-4xl font-bold text-white mb-1">30%</div>
                <div className="text-gray-400">Cost Savings</div>
              </div>
              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="text-4xl font-bold text-white mb-1">Smart</div>
                <div className="text-gray-400">Predictions</div>
              </div>
              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="text-4xl font-bold text-white mb-1">Easy</div>
                <div className="text-gray-400">Installation</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-gradient-to-b from-[#1e293b] to-[#0f172a]">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Everything you need for smart filter monitoring</h2>
              <p className="text-xl text-gray-400">Save money, improve air quality, and never miss a filter change with intelligent monitoring.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-blue-500/50 transition-colors group">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-6 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-blue-400 transition-colors">Lab-Grade Pressure Sensing</h3>
                <p className="text-gray-400 mb-4">The smart filter monitor measures the pressure drop across your filter with laboratory precision, all day, every day.</p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Plug-and-play installation
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    WiFi-enabled monitoring
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Battery-friendly operation
                  </li>
                </ul>
              </div>

              {/* Feature 2 */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-purple-500/50 transition-colors group">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-6 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-purple-400 transition-colors">Filter Life Prediction</h3>
                <p className="text-gray-400 mb-4">AI-powered predictions tell you exactly when to change your filter based on actual usage patterns.</p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Predictive maintenance
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Usage pattern analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Cost saving reports
                  </li>
                </ul>
              </div>

              {/* Feature 3 */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-cyan-500/50 transition-colors group">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-6 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-cyan-400 transition-colors">Smart Alerts</h3>
                <p className="text-gray-400 mb-4">Never miss a filter change. Get timely alerts based on actual filter condition, not just calendar dates.</p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Filter change reminders
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Email & SMS alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Performance warnings
                  </li>
                </ul>
              </div>

              {/* Feature 4 */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-green-500/50 transition-colors group">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-6 text-green-400 group-hover:bg-green-500 group-hover:text-white transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-green-400 transition-colors">Secure Access</h3>
                <p className="text-gray-400 mb-4">Enterprise-grade security with user management and access controls.</p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    API key authentication
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    User management
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Encrypted data
                  </li>
                </ul>
              </div>

              {/* Feature 5 */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-amber-500/50 transition-colors group">
                <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center mb-6 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-amber-400 transition-colors">Data Export</h3>
                <p className="text-gray-400 mb-4">Export and backup your sensor data in multiple formats for further analysis.</p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    CSV and JSON formats
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Scheduled exports
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    API integration
                  </li>
                </ul>
              </div>

              {/* Feature 6 */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-rose-500/50 transition-colors group">
                <div className="w-12 h-12 bg-rose-500/20 rounded-lg flex items-center justify-center mb-6 text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-rose-400 transition-colors">Mobile Access</h3>
                <p className="text-gray-400 mb-4">Monitor your environment from anywhere with our responsive mobile interface.</p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Responsive design
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Push notifications
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Offline capabilities
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">How It Works</h2>
              <p className="text-xl text-gray-400">Get up and running in minutes with our easy setup process</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Step 1 */}
              <div className="relative">
                <div className="bg-white/5 rounded-xl p-8 border border-white/10 h-full relative z-10">
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
                    1
                  </div>
                  <h3 className="text-xl font-semibold mb-4 pt-2">Install the Monitor</h3>
                  <p className="text-gray-400 mb-4">Mount the smart filter monitor next to your furnace and connect the two flexible tubes from your kit — one on each side of the filter.</p>
                  <div className="text-sm text-gray-500 space-y-2">
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Drill one small hole on each side of your filter</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Insert a tube into each hole and connect them to the monitor</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Plug in the power adapter — that&apos;s the whole install</span>
                    </div>
                  </div>
                </div>
                <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 hidden md:block">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="bg-white/5 rounded-xl p-8 border border-white/10 h-full relative z-10">
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-xl">
                    2
                  </div>
                  <h3 className="text-xl font-semibold mb-4 pt-2">Connect It to Your WiFi</h3>
                  <p className="text-gray-400 mb-4">No apps to install and no technical setup — the monitor walks you through it from your phone.</p>
                  <div className="text-sm text-gray-500 space-y-2">
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>The monitor creates its own temporary WiFi network</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Join it from your phone and pick your home WiFi</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Scan the QR code on the monitor to register it to your account</span>
                    </div>
                  </div>
                </div>
                <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 hidden md:block">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Step 3 */}
              <div>
                <div className="bg-white/5 rounded-xl p-8 border border-white/10 h-full">
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold text-xl">
                    3
                  </div>
                  <h3 className="text-xl font-semibold mb-4 pt-2">Let It Do the Math</h3>
                  <p className="text-gray-400 mb-4">The monitor tracks your filter around the clock, and a new one ships automatically when replacing saves you money.</p>
                  <div className="text-sm text-gray-500 space-y-2">
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Watch live pressure readings and wasted-energy cost</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Get an email before any order — cancel with one click</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>The right filter arrives before the old one costs you money</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="mt-16 text-center">
              <Link
                href={session ? "/dashboard" : "/api/auth/signin"}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium text-center transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <span>{session ? "Go to Your Dashboard" : "Get Started Now"}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* What's Included Section */}
        <section className="py-24 bg-gradient-to-b from-[#1e293b] to-[#0f172a]">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Your data is free. The magic is in the filters.</h2>
              <p className="text-lg text-gray-400">
                Every monitor comes with live data, no strings attached. Enroll in Filter
                AutoShip — your replacement filters, delivered automatically — and the full
                intelligence turns on. No monthly fee, ever.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free tier */}
              <div className="bg-white/5 rounded-xl p-8 border border-white/10">
                <h3 className="text-xl font-semibold mb-1">With every monitor</h3>
                <p className="text-sm text-gray-500 mb-6">Included free, forever</p>
                <ul className="space-y-3 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    Live pressure &amp; temperature on your dashboard
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    Works with your smart home — Home Assistant today; Google Home, Alexa &amp; SmartThings coming
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    Device status &amp; battery at a glance
                  </li>
                </ul>
              </div>

              {/* AutoShip tier */}
              <div className="bg-blue-500/10 rounded-xl p-8 border border-blue-500/40 relative">
                <span className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                  Filter AutoShip
                </span>
                <h3 className="text-xl font-semibold mb-1">With automatic filter delivery</h3>
                <p className="text-sm text-blue-200/60 mb-6">Just buy your filters through us — no subscription fee</p>
                <ul className="space-y-3 text-gray-200 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    Everything in the free tier
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span><strong>Energy-savings calculation</strong> — see exactly what your filter is costing you in real dollars</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span><strong>Historical trending</strong> — pressure, runtime, and cost over weeks and seasons</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span><strong>Filters ship themselves</strong> — exactly when replacing saves you money, with an email and one-click cancel first</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span><strong>Advanced HVAC diagnostics</strong> <span className="text-blue-300/60">(coming soon)</span> — early warnings for airflow and system problems</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-[#0f172a] border-t border-white/10 py-12">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">MySmartFilter</h3>
                <p className="text-gray-400 text-sm">
                  Replace your HVAC filter when the energy it wastes costs more than a new one — automatically.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Product</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><Link href="/store" className="hover:text-white transition-colors">Filter Store</Link></li>
                  <li><Link href="/install" className="hover:text-white transition-colors">Installation Guide</Link></li>
                  <li><Link href="/setup" className="hover:text-white transition-colors">Device Setup</Link></li>
                  <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                  <li><Link href="/settings/integrations" className="hover:text-white transition-colors">API &amp; Integrations</Link></li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Legal</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                  <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Contact</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>
                    <a href="mailto:support@mysmartfilter.com" className="hover:text-white transition-colors">
                      support@mysmartfilter.com
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-500 text-sm">© 2026 MySmartFilter. All rights reserved.</p>
              <div className="mt-4 md:mt-0">
                <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy Policy</Link>
                <span className="text-gray-600 mx-2">·</span>
                <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">Terms of Service</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </HydrateClient>
  );
}
