import { createContext, useContext, useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowRight, BarChart3, Bookmark, BookmarkCheck, BriefcaseBusiness, Building2, Check, ChevronDown, CircleUserRound, Clock3, Eye, EyeOff, FileText, Filter, HeartHandshake, LayoutDashboard, MapPin, Menu, Plus, Search, ShieldCheck, Sparkles, Target, TrendingUp, Users, X } from 'lucide-react'
import './App.css'

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

const demoJobs = [
  { _id: 'demo-1', title: 'Frontend Engineer', companyName: 'Linear Labs', location: 'Bengaluru, India', type: 'Full-time', salary: '₹12–18 LPA', category: 'Engineering', description: 'Build thoughtful product experiences with a small, ambitious team.', tags: ['React', 'TypeScript', 'Design systems'] },
  { _id: 'demo-2', title: 'Product Designer', companyName: 'Northstar', location: 'Remote · India', type: 'Full-time', salary: '₹10–16 LPA', category: 'Design', description: 'Make complex workflows feel effortless for teams around the world.', tags: ['Figma', 'Prototyping', 'Research'] },
  { _id: 'demo-3', title: 'Graduate Software Engineer', companyName: 'Orbit Systems', location: 'Pune, India', type: 'Internship', salary: '₹35k–50k / mo', category: 'Engineering', description: 'Start your engineering career shipping tools used by millions.', tags: ['Node.js', 'MongoDB', 'APIs'] },
  { _id: 'demo-4', title: 'Data Analyst', companyName: 'Fieldwork', location: 'Hyderabad, India', type: 'Full-time', salary: '₹8–12 LPA', category: 'Data', description: 'Turn product data into a clearer picture of what matters.', tags: ['SQL', 'Python', 'Analytics'] },
]

function getToken() { return localStorage.getItem('pathway-token') || sessionStorage.getItem('pathway-token') }

async function request(path, options = {}) {
  const token = getToken()
  if (options.body instanceof FormData) {
    const resume = options.body.get('resume')
    if (resume instanceof File && !resume.name) options.body.delete('resume')
  }
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Something went wrong. Please try again.')
  return payload
}

const PortalContext = createContext(null)
const usePortal = () => useContext(PortalContext)

function PortalProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(() => Boolean(getToken()))
  const [jobs, setJobs] = useState(demoJobs)
  const [managedJobs, setManagedJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [users, setUsers] = useState([])
  const [messages, setMessages] = useState([])
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    let active = true
    request('/jobs').then(({ jobs: rows }) => { if (active) setJobs(rows) }).catch((error) => { if (active) setDataError(error.message) })
    const token = getToken()
    if (token) request('/auth/me').then(({ user: current }) => { if (active) setUser(current) }).catch(() => { localStorage.removeItem('pathway-token'); sessionStorage.removeItem('pathway-token') }).finally(() => { if (active) setAuthLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user) return
    if (user.role === 'student') request('/applications/mine').then(({ applications: rows }) => setApplications(rows)).catch((error) => setDataError(error.message))
    if (user.role === 'recruiter') {
      request('/applications').then(({ applications: rows }) => setApplications(rows)).catch((error) => setDataError(error.message))
      request('/jobs/mine').then(({ jobs: rows }) => setManagedJobs(rows)).catch((error) => setDataError(error.message))
    }
    if (user.role === 'admin') {
      request('/applications').then(({ applications: rows }) => setApplications(rows)).catch((error) => setDataError(error.message))
      request('/users').then(({ users: rows }) => setUsers(rows)).catch((error) => setDataError(error.message))
      request('/jobs/admin/all').then(({ jobs: rows }) => setManagedJobs(rows)).catch((error) => setDataError(error.message))
      request('/contact').then(({ messages: rows }) => setMessages(rows)).catch((error) => setDataError(error.message))
    }
  }, [user])

  const toggleSavedJob = async (job) => {
    if (!user || user.role !== 'student') throw new Error('Sign in as a student to save jobs.')
    const savedIds = (user.savedJobs || []).map((id) => String(id?._id || id))
    const isSaved = savedIds.includes(String(job._id))
    await request(`/users/me/saved-jobs/${job._id}`, { method: isSaved ? 'DELETE' : 'PUT' })
    setUser((current) => ({ ...current, savedJobs: isSaved ? savedIds.filter((id) => id !== String(job._id)) : [...savedIds, String(job._id)] }))
  }

  return <PortalContext.Provider value={{ user, setUser, authLoading, jobs, setJobs, managedJobs, setManagedJobs, applications, setApplications, users, setUsers, messages, setMessages, dataError, setDataError, toggleSavedJob }}>{children}</PortalContext.Provider>
}

export default function PortalApp() {
  return <BrowserRouter><PortalProvider><PortalShell /></PortalProvider></BrowserRouter>
}

function PortalShell() {
  const { user, setUser, authLoading, dataError } = usePortal()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenu, setMobileMenu] = useState(false)
  const isWorkspace = location.pathname.startsWith('/dashboard') || location.pathname === '/applications' || location.pathname.startsWith('/profile/')
  useEffect(() => {
    if (!mobileMenu) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMobileMenu(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileMenu])
  const logout = () => { localStorage.removeItem('pathway-token'); sessionStorage.removeItem('pathway-token'); setUser(null); setMobileMenu(false); navigate('/') }
  return <div className="app-shell">
    <header className="topbar">
      <Link className="brand" to="/"><span className="brand-mark"><BriefcaseBusiness size={19} /></span><span>pathway<span className="brand-period">.</span></span></Link>
      <nav className="top-links" aria-label="Main navigation"><NavLink className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`} to="/jobs">Find Jobs</NavLink><NavLink end className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`} to="/register/recruiter">For Employers</NavLink><NavLink className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`} to="/about">About</NavLink><NavLink className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`} to="/contact">Contact</NavLink></nav>
      <div className="top-actions">{user ? <><Link className="account-button" to={`/dashboard/${user.role}`}><span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span><span>{user.name?.split(' ')[0]}</span><ChevronDown size={15} /></Link><button className="text-action" onClick={logout}>Sign out</button></> : <><div className="nav-dropdown"><button className={`nav-button nav-dropdown-trigger${location.pathname.startsWith('/login') ? ' active' : ''}`} type="button">Log in <ChevronDown size={14} /></button><div className="nav-dropdown-menu"><Link to="/login/student">Student login</Link><Link to="/login/recruiter">Recruiter login</Link><Link to="/login/admin">Admin login</Link></div></div><div className="nav-dropdown"><button className={`nav-button nav-dropdown-trigger${location.pathname.startsWith('/register') && location.pathname !== '/register/recruiter' ? ' active' : ''}`} type="button">Register <ChevronDown size={14} /></button><div className="nav-dropdown-menu"><Link to="/register/student">As a student</Link><Link to="/register/recruiter">As a recruiter</Link></div></div></>}</div>
      <button className="mobile-toggle" aria-label="Toggle navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu((open) => !open)}>{mobileMenu ? <X /> : <Menu />}</button>
    </header>
    {mobileMenu && <button className="nav-scrim" type="button" aria-label="Close navigation menu" onClick={() => setMobileMenu(false)} />}
    <nav className={`mobile-nav ${mobileMenu && !isWorkspace ? 'is-open' : ''}`} aria-label="Mobile navigation" aria-hidden={!mobileMenu || isWorkspace}>
      <NavLink className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`} onClick={() => setMobileMenu(false)} tabIndex={mobileMenu && !isWorkspace ? 0 : -1} to="/jobs">Find Jobs</NavLink><NavLink end className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`} onClick={() => setMobileMenu(false)} tabIndex={mobileMenu && !isWorkspace ? 0 : -1} to="/register/recruiter">For Employers</NavLink><NavLink className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`} onClick={() => setMobileMenu(false)} tabIndex={mobileMenu && !isWorkspace ? 0 : -1} to="/about">About</NavLink><NavLink className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`} onClick={() => setMobileMenu(false)} tabIndex={mobileMenu && !isWorkspace ? 0 : -1} to="/contact">Contact</NavLink>
      {user ? <><Link onClick={() => setMobileMenu(false)} tabIndex={mobileMenu && !isWorkspace ? 0 : -1} to={`/dashboard/${user.role}`}>Dashboard</Link><button tabIndex={mobileMenu && !isWorkspace ? 0 : -1} onClick={logout}>Sign out</button></> : <><div className="nav-dropdown"><button className={`nav-button nav-dropdown-trigger${location.pathname.startsWith('/login') ? ' active' : ''}`} type="button" tabIndex={mobileMenu && !isWorkspace ? 0 : -1}>Log in <ChevronDown size={14} /></button><div className="nav-dropdown-menu"><Link onClick={() => setMobileMenu(false)} tabIndex={mobileMenu && !isWorkspace ? 0 : -1} to="/login/student">Student login</Link><Link onClick={() => setMobileMenu(false)} tabIndex={mobileMenu && !isWorkspace ? 0 : -1} to="/login/recruiter">Recruiter login</Link></div></div><div className="nav-dropdown"><button className={`nav-button nav-dropdown-trigger${location.pathname.startsWith('/register') && location.pathname !== '/register/recruiter' ? ' active' : ''}`} type="button" tabIndex={mobileMenu && !isWorkspace ? 0 : -1}>Register <ChevronDown size={14} /></button><div className="nav-dropdown-menu"><Link onClick={() => setMobileMenu(false)} tabIndex={mobileMenu && !isWorkspace ? 0 : -1} to="/register/student">As a student</Link><Link onClick={() => setMobileMenu(false)} tabIndex={mobileMenu && !isWorkspace ? 0 : -1} to="/register/recruiter">As a recruiter</Link></div></div></>}
    </nav>
    {user && isWorkspace && <WorkspaceSidebar user={user} open={mobileMenu} onNavigate={() => setMobileMenu(false)} />}
    <main className={user && isWorkspace ? 'main-content with-sidebar' : 'main-content'}>
      {dataError && <div className="api-notice" role="status">{dataError}</div>}
      {location.state?.registrationSuccess && <div className="success-message" role="status"><Check size={16} />{location.state.registrationSuccess}</div>}
      {authLoading ? <div className="loading-state"><span className="spinner" />Restoring your session…</div> : <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login/student" element={<AuthRoute mode="login" role="student" />} />
        <Route path="/register/student" element={<AuthRoute mode="register" role="student" />} />
        <Route path="/login/recruiter" element={<AuthRoute mode="login" role="recruiter" />} />
        <Route path="/register/recruiter" element={<AuthRoute mode="register" role="recruiter" />} />
        <Route path="/login/admin" element={<AuthRoute mode="login" role="admin" />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/jobs" element={<FindJobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/dashboard/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/recruiter" element={<ProtectedRoute role="recruiter"><RecruiterDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/recruiter/jobs" element={<ProtectedRoute role="recruiter"><RecruiterJobsPage /></ProtectedRoute>} />
        <Route path="/dashboard/recruiter/jobs/new" element={<ProtectedRoute role="recruiter"><JobEditor /></ProtectedRoute>} />
        <Route path="/dashboard/recruiter/jobs/:jobId/edit" element={<ProtectedRoute role="recruiter"><JobEditor /></ProtectedRoute>} />
        <Route path="/dashboard/recruiter/applicants" element={<ProtectedRoute role="recruiter"><RecruiterApplicantsPage /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/admin/users" element={<ProtectedRoute role="admin"><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/dashboard/admin/jobs" element={<ProtectedRoute role="admin"><AdminJobsPage /></ProtectedRoute>} />
        <Route path="/dashboard/admin/messages" element={<ProtectedRoute role="admin"><AdminMessagesPage /></ProtectedRoute>} />
        <Route path="/profile/student" element={<ProtectedRoute role="student"><ProfilePage /></ProtectedRoute>} />
        <Route path="/profile/recruiter" element={<ProtectedRoute role="recruiter"><ProfilePage /></ProtectedRoute>} />
        <Route path="/applications" element={<ProtectedRoute role="student"><ApplicationsPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>}
      <SiteFooter />
    </main>
  </div>
}

function WorkspaceSidebar({ user, open, onNavigate }) {
  const items = user.role === 'student'
    ? [['/dashboard/student', LayoutDashboard, 'Overview'], ['/jobs', Search, 'Find jobs'], ['/applications', FileText, 'My applications'], ['/profile/student', CircleUserRound, 'My profile']]
    : user.role === 'recruiter'
      ? [['/dashboard/recruiter', LayoutDashboard, 'Overview'], ['/dashboard/recruiter/jobs', BriefcaseBusiness, 'Manage jobs'], ['/dashboard/recruiter/applicants', Users, 'Applicants'], ['/profile/recruiter', Building2, 'Company profile']]
      : [['/dashboard/admin', LayoutDashboard, 'Overview'], ['/dashboard/admin/users', Users, 'People'], ['/dashboard/admin/jobs', BriefcaseBusiness, 'All jobs'], ['/dashboard/admin/messages', FileText, 'Contact messages']]
  return <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><div className="workspace-label">{user.role.toUpperCase()} WORKSPACE</div><nav className="side-nav">{items.map(([path, Icon, label]) => <NavLink key={path} to={path} end onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'selected' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><div className="help-panel"><Sparkles size={17} /><strong>Your next chapter starts here.</strong><span>Keep your profile fresh to stand out to employers.</span><Link onClick={onNavigate} to={user.role === 'student' ? '/profile/student' : user.role === 'recruiter' ? '/profile/recruiter' : '/dashboard/admin/users'}>Go to your workspace <ArrowRight size={13} /></Link></div></div></aside>
}

function ProtectedRoute({ role, children }) {
  const { user, authLoading } = usePortal()
  const location = useLocation()
  if (authLoading) return <div className="loading-state"><span className="spinner" />Restoring your session…</div>
  if (!user) return <Navigate to={`/login/${role}`} replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={`/dashboard/${user.role}`} replace />
  return children
}

function AuthRoute({ mode, role }) {
  const { user } = usePortal()
  if (user) return <Navigate to={`/dashboard/${user.role}`} replace />
  return <AuthPage mode={mode} role={role} />
}

function HomePage() {
  const { jobs } = usePortal()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const search = (event) => { event.preventDefault(); navigate(`/jobs?q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`) }
  return <>
    <section className="hero-section"><div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot" /> A better way to begin</span><h1>Work that moves<br />you <em>forward.</em></h1><p>Find your place in the world of work. Thoughtful opportunities for the next generation of builders.</p><form className="hero-search" onSubmit={search}><label><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Role, skill or company" /></label><span className="search-divider" /><label><MapPin size={18} /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City or remote" /></label><button className="button button-dark" type="submit">Search jobs <ArrowRight size={16} /></button></form><div className="hero-note"><span className="avatar-stack"><i>J</i><i>A</i><i>M</i></span><span><b>2,400+</b> people found their next move</span></div></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85" alt="A team collaborating around a table" /><div className="visual-note"><span className="note-icon"><Sparkles size={17} /></span><span><strong>Good work, good people.</strong><small>Find both in one place.</small></span></div><div className="visual-stamp">YOUR<br />NEXT<br />CHAPTER</div></div></section>
    <div className="trust-strip"><span>TEAMS BUILDING WHAT’S NEXT</span><b>northstar</b><b className="trust-serif">orbit</b><b className="trust-mono">linear labs</b><b>FIELDWORK</b><b className="trust-serif">otherland</b></div>
    <section className="section-heading" id="open-roles"><div><span className="eyebrow">CURATED FOR YOUR NEXT MOVE</span><h2>Open roles worth a look<span className="heading-period">.</span></h2></div><Link className="section-count" to="/jobs">Browse all opportunities <ArrowRight size={15} /></Link></section>
    <div className="job-list">{jobs.slice(0, 4).map((job, index) => <JobRow key={job._id} job={job} index={index} />)}</div>
    <section className="why-section"><div className="feature-intro"><span className="eyebrow"><span className="eyebrow-dot" /> THE PATHWAY DIFFERENCE</span><h2>A better first step<br />starts <em>here.</em></h2><p>Career moves should feel clear, human, and full of possibility. We bring the right people and the right opportunities closer together.</p></div><div className="feature-grid"><article className="feature-card"><span className="feature-icon"><Target size={20} /></span><span className="feature-index">01</span><h3>Opportunities with purpose</h3><p>Find roles built around real work, honest expectations, and room to grow.</p></article><article className="feature-card"><span className="feature-icon"><HeartHandshake size={20} /></span><span className="feature-index">02</span><h3>People-first connections</h3><p>Make it easier for candidates and teams to meet on more than a job title.</p></article><article className="feature-card"><span className="feature-icon"><TrendingUp size={20} /></span><span className="feature-index">03</span><h3>Progress you can follow</h3><p>Keep your profile, applications, and conversations moving in one place.</p></article></div></section>
    <section className="how-section"><div className="how-heading"><span className="eyebrow">A LITTLE CLOSER, STEP BY STEP</span><h2>Make your next move in three steps<span className="heading-period">.</span></h2></div><div className="steps-grid"><article><span>01</span><h3>Show up as yourself</h3><p>Create a profile that tells a team what you care about and what you can bring.</p></article><article><span>02</span><h3>Find a fit</h3><p>Search thoughtful openings by role, skill, location, and the kind of work you want.</p></article><article><span>03</span><h3>Move forward</h3><p>Apply with your resume and track every update from your dashboard.</p></article></div><Link className="button button-dark" to="/register/student">Build your profile <ArrowRight size={15} /></Link></section>
    <section className="community-section"><div className="how-heading"><span className="eyebrow">NOT JUST A JOB BOARD</span><h2>Small wins. Big next chapters<span className="heading-period">.</span></h2></div><div className="testimonial-grid"><article className="quote-card"><span className="quote-mark">“</span><p>I finally had one place to keep track of the roles I cared about and what happened after I applied.</p><div className="quote-person"><span className="quote-avatar">A</span><span><strong>Aria</strong><small>Early-career designer</small></span></div></article><article className="quote-card quote-featured"><span className="quote-mark">“</span><p>We met candidates who were excited about the work itself. That made every conversation better.</p><div className="quote-person"><span className="quote-avatar">K</span><span><strong>Karan</strong><small>Hiring team lead</small></span></div></article><article className="quote-card"><span className="quote-mark">“</span><p>The search felt less overwhelming. Clear roles and useful updates made a real difference.</p><div className="quote-person"><span className="quote-avatar">M</span><span><strong>Mira</strong><small>Recent graduate</small></span></div></article></div></section>
    <section className="bottom-cta"><div><span className="eyebrow">YOUR STORY IS STILL BEING WRITTEN</span><h2>Find work that feels like <em>you.</em></h2></div><Link className="button button-light" to="/register/student">Create your free profile <ArrowRight size={16} /></Link></section>
  </>
}

function FindJobsPage() {
  const { jobs } = usePortal()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [location, setLocation] = useState(params.get('location') || '')
  const [typeFilter, setTypeFilter] = useState('All types')
  const filtered = jobs.filter((job) => `${job.title} ${job.companyName} ${job.category || ''} ${(job.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase()) && job.location.toLowerCase().includes(location.toLowerCase()) && (typeFilter === 'All types' || job.type === typeFilter))
  const updateQuery = (value) => {
    setQuery(value)
    setParams((current) => { if (value) current.set('q', value); else current.delete('q'); return current }, { replace: true })
  }
  const updateLocation = (value) => {
    setLocation(value)
    setParams((current) => { if (value) current.set('location', value); else current.delete('location'); return current }, { replace: true })
  }
  return <><PageHeading eyebrow="FIND YOUR NEXT MOVE" title="Find a job." subtitle="Explore thoughtful opportunities from teams building what comes next." /><JobFilters query={query} setQuery={updateQuery} location={location} setLocation={updateLocation} typeFilter={typeFilter} setTypeFilter={setTypeFilter} /><div className="job-list">{filtered.map((job, index) => <JobRow key={job._id} job={job} index={index} />)}{!filtered.length && <EmptyState title="No roles match just yet" text="Try a different title, skill or location." />}</div></>
}

function JobDetailsPage() {
  const { jobId } = useParams()
  const { jobs } = usePortal()
  const [loadedJob, setLoadedJob] = useState(null)
  const job = jobs.find((item) => item._id === jobId) || loadedJob
  const [error, setError] = useState('')
  useEffect(() => {
    if (jobs.some((item) => item._id === jobId)) return
    request(`/jobs/${jobId}`).then(({ job: result }) => setLoadedJob(result)).catch((reason) => setError(reason.message))
  }, [jobId, jobs])
  if (!job) return error ? <EmptyState title="This job is unavailable" text={error}><Link className="button button-outline" to="/jobs">Back to jobs</Link></EmptyState> : <div className="loading-state"><span className="spinner" />Loading job details…</div>
  return <JobDetailContent job={job} />
}

function JobDetailContent({ job }) {
  const { user, applications, setApplications } = usePortal()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const applied = applications.some((application) => (application.job?._id || application.job) === job._id)
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    const formData = new FormData(event.currentTarget); formData.append('jobId', job._id)
    try { await request('/applications', { method: 'POST', body: formData }); const { applications: rows } = await request('/applications/mine'); setApplications(rows); navigate('/applications') }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  return <><Link className="back-link" to="/jobs">← Back to jobs</Link><article className="detail-page"><div className="detail-main"><span className="eyebrow">{job.category || 'OPPORTUNITY'} · {job.type}</span><h1>{job.title}</h1><div className="job-meta detail-meta"><span><Building2 size={15} />{job.companyName}</span><span><MapPin size={15} />{job.location}</span></div><div className="detail-tags">{job.salary && <span>{job.salary}</span>}<span>{job.type}</span></div><h2>About the role</h2><p className="detail-description">{job.description}</p>{job.tags?.length > 0 && <><h2>Skills and experience</h2><div className="job-tags">{job.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></>}{job.requirements && <p className="detail-description">{job.requirements}</p>}</div><aside className="apply-panel"><span className="eyebrow">THE NEXT STEP</span><h2>Does this feel like you?</h2>{!user ? <><p>Sign in as a student to send your resume and a note to the hiring team.</p><Link className="button button-dark full-button" to="/login/student" state={{ from: `/jobs/${job._id}` }}>Student login to apply <ArrowRight size={15} /></Link><Link className="auth-alternative" to="/register/student">New here? Create a student profile</Link></> : user.role !== 'student' ? <p>Applications are available to student accounts.</p> : applied ? <div className="success-message"><Check size={17} /> You’ve applied. Track updates in My applications.</div> : <form className="form-stack" onSubmit={submit}><label>Note to the hiring team<textarea name="coverLetter" rows="4" maxLength="3000" placeholder="Why does this role feel right for you?" /></label><label className="upload-field"><FileText size={20} /><span><b>Attach your resume</b><small>PDF, DOC or DOCX · up to 5 MB</small></span><input name="resume" type="file" accept=".pdf,.doc,.docx" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark full-button" disabled={busy}>{busy ? 'Sending…' : 'Send application'} <ArrowRight size={15} /></button></form>}</aside></article></>
}

function AuthPage({ mode, role }) {
  const { setUser } = usePortal()
  const location = useLocation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [forgot, setForgot] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const isRegister = mode === 'register'
  const roleName = role === 'student' ? 'student' : role === 'recruiter' ? 'recruiter' : 'administrator'
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const formData = new FormData(event.currentTarget)
    if (isRegister && formData.get('password') !== formData.get('confirmPassword')) { setError('Passwords do not match.'); setBusy(false); return }
    if (isRegister) {
      formData.delete('confirmPassword')
      formData.delete('terms')
      formData.set('role', role)
    }
    try {
      const body = isRegister ? formData : JSON.stringify({ email: formData.get('email'), password: formData.get('password'), role })
      const { token, user, message } = await request(`/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body })
      if (user.role !== role) throw new Error(`This is a ${user.role} account. Please use the ${user.role} sign-in page.`)
      const remember = formData.has('remember')
      localStorage.removeItem('pathway-token'); sessionStorage.removeItem('pathway-token')
      ;(remember || isRegister ? localStorage : sessionStorage).setItem('pathway-token', token)
      setUser(user)
      navigate(location.state?.from || `/dashboard/${user.role}`, { replace: true, state: isRegister ? { registrationSuccess: message } : undefined })
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  const requestReset = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { const result = await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: new FormData(event.currentTarget).get('email') }) }); setNotice(result.message) }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  return <section className="auth-page"><div className="auth-story"><span className="eyebrow"><span className="eyebrow-dot" /> PATHWAY FOR {role.toUpperCase()}S</span><h1>{isRegister ? 'Make room for what’s next.' : forgot ? 'Let’s get you back in.' : 'Welcome back.'}</h1><p>{role === 'student' ? 'A thoughtful first step toward work that feels like you.' : role === 'recruiter' ? 'Meet people who care about the work as much as you do.' : 'Keep the Pathway community moving forward.'}</p><div className="auth-story-mark"><BriefcaseBusiness size={24} /><span>Work that moves you forward.</span></div></div><div className="auth-form-panel"><span className="eyebrow">{isRegister ? 'CREATE YOUR PROFILE' : forgot ? 'PASSWORD RECOVERY' : 'SIGN IN TO YOUR ACCOUNT'}</span><h2>{isRegister ? `Join as a ${roleName}.` : forgot ? 'Reset your password.' : `${roleName[0].toUpperCase()}${roleName.slice(1)} sign in.`}</h2><p className="form-intro">{isRegister ? 'Your next chapter is one good connection away.' : forgot ? 'We’ll send a one-hour reset link if the account is registered.' : 'Pick up where you left off.'}</p>{forgot ? <form className="form-stack" onSubmit={requestReset}><label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}<button className="button button-dark full-button" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={16} /></button><button className="text-link-button auth-back" type="button" onClick={() => { setForgot(false); setError(''); setNotice('') }}>Back to sign in</button></form> : <form className="form-stack" onSubmit={submit}>{isRegister && <><label>{role === 'recruiter' ? 'Recruiter name' : 'Full name'}<input name="name" autoComplete="name" maxLength="100" required placeholder={role === 'recruiter' ? 'Your name' : 'Your full name'} /></label>{role === 'recruiter' && <label>Company name<input name="companyName" maxLength="120" required placeholder="Your company" /></label>}</>}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><div className="password-field"><label htmlFor="auth-password">Password</label><div><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} minLength="8" required placeholder={isRegister ? 'At least 8 characters' : 'Your password'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>{isRegister && <><label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength="8" required placeholder="Enter your password again" /></label><div className="form-two"><label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength="30" required placeholder="+1 555 000 0000" /></label><label>Location<input name="location" autoComplete="address-level2" maxLength="120" required placeholder="City, country" /></label></div>{role === 'student' && <label className="upload-field"><FileText size={20} /><span><b>Upload your resume</b><small>PDF, DOC or DOCX · up to 5 MB</small></span><input name="resume" type="file" accept=".pdf,.doc,.docx" /></label>}<label className="terms-check"><input name="terms" type="checkbox" required /><span>I agree to the <Link to="/terms">Terms of Service</Link> and Privacy Policy.</span></label></>}{!isRegister && <div className="auth-options"><label className="remember-check"><input name="remember" type="checkbox" defaultChecked /><span>Remember me</span></label><button type="button" className="text-link-button" onClick={() => { setForgot(true); setError(''); setNotice('') }}>Forgot password?</button></div>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark full-button" disabled={busy}>{busy ? 'One moment…' : isRegister ? 'Create account' : 'Log in'} <ArrowRight size={16} /></button></form>}<p className="auth-switch">{isRegister ? 'Already have a profile?' : 'New to Pathway?'} <Link to={`/${isRegister ? 'login' : 'register'}/${role}`}>{isRegister ? 'Log in' : 'Create an account'}</Link></p><div className="auth-role-links">{role !== 'student' && <Link to={`/${isRegister ? 'register' : 'login'}/student`}>Student {isRegister ? 'registration' : 'login'}</Link>}{role !== 'recruiter' && role !== 'admin' && <Link to={`/${isRegister ? 'register' : 'login'}/recruiter`}>Recruiter {isRegister ? 'registration' : 'login'}</Link>}</div></div></section>
}

function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    if (form.get('password') !== form.get('confirmPassword')) { setError('Passwords do not match.'); setBusy(false); return }
    try { await request(`/auth/reset-password/${token}`, { method: 'POST', body: JSON.stringify({ password: form.get('password') }) }); setSuccess(true) }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  return <section className="auth-page reset-page"><div className="auth-story"><span className="eyebrow">PATHWAY ACCOUNT SECURITY</span><h1>A fresh start, securely.</h1><p>Choose a new password to get back to the work and opportunities you care about.</p></div><div className="auth-form-panel"><span className="eyebrow">PASSWORD RECOVERY</span><h2>Set a new password.</h2>{success ? <><p className="success-message">Your password has been updated.</p><button className="button button-dark full-button" onClick={() => navigate('/login/student')}>Go to sign in <ArrowRight size={15} /></button></> : <form className="form-stack" onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength="8" required /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength="8" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark full-button" disabled={busy}>{busy ? 'Saving…' : 'Update password'} <ArrowRight size={15} /></button></form>}</div></section>
}

function RecruiterDashboard() {
  const { user, managedJobs, applications } = usePortal()
  const activeJobs = managedJobs.filter((job) => job.status === 'active')
  return <><PageHeading eyebrow="RECRUITER WORKSPACE" title={`Welcome back, ${user.name.split(' ')[0]}.`} subtitle="Meet people who care about the work." action={<Link className="button button-dark" to="/dashboard/recruiter/jobs/new"><Plus size={17} /> Post a job</Link>} /><div className="admin-metrics"><Metric label="Active openings" value={activeJobs.length.toString().padStart(2, '0')} note="Across your workspace" /><Metric label="Applicants" value={applications.length.toString().padStart(2, '0')} note="Ready for your review" /><div className="metric metric-accent"><ShieldCheck size={22} /><span>Your hiring workspace</span><strong>Make a thoughtful hire</strong><Link to="/dashboard/recruiter/applicants">Review applicants <ArrowRight size={14} /></Link></div></div><section className="section-heading compact"><div><span className="eyebrow">YOUR OPENINGS</span><h2>Manage jobs<span className="heading-period">.</span></h2></div><Link className="button button-outline" to="/dashboard/recruiter/jobs">View all <ArrowRight size={15} /></Link></section><ManagedJobsList jobs={managedJobs.slice(0, 3)} /></>
}

function RecruiterJobsPage() {
  const { managedJobs } = usePortal()
  return <><PageHeading eyebrow="YOUR OPENINGS" title="Manage jobs." subtitle="Edit, pause or remove your listings." action={<Link className="button button-dark" to="/dashboard/recruiter/jobs/new"><Plus size={17} /> Post a job</Link>} /><ManagedJobsList jobs={managedJobs} /></>
}

function ManagedJobsList({ jobs }) {
  return <div className="managed-job-list">{jobs.map((job) => <ManagedJobRow key={job._id} job={job} />)}{!jobs.length && <EmptyState title="No openings yet" text="Your next great hire starts with a job post."><Link className="button button-dark" to="/dashboard/recruiter/jobs/new"><Plus size={16} /> Post your first job</Link></EmptyState>}</div>
}

function ManagedJobRow({ job }) {
  const { setManagedJobs, setJobs } = usePortal()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const updateStatus = async () => {
    setBusy(true); setError('')
    try {
      const { job: updated } = await request(`/jobs/${job._id}`, { method: 'PATCH', body: JSON.stringify({ status: job.status === 'closed' ? 'active' : 'closed' }) })
      setManagedJobs((current) => current.map((item) => item._id === job._id ? updated : item))
      setJobs((current) => current.map((item) => item._id === job._id ? updated : item))
    } catch (reason) { setError(reason.message) } finally { setBusy(false) }
  }
  const deleteJob = async () => {
    if (!window.confirm(`Delete “${job.title}” and its applications?`)) return
    setBusy(true); setError('')
    try {
      await request(`/jobs/${job._id}`, { method: 'DELETE' })
      setManagedJobs((current) => current.filter((item) => item._id !== job._id))
      setJobs((current) => current.filter((item) => item._id !== job._id))
    } catch (reason) { setError(reason.message) } finally { setBusy(false) }
  }
  return <article className="managed-row"><div className="managed-job-summary"><div className="company-mark">{job.companyName?.slice(0, 2).toUpperCase()}</div><div><h3>{job.title}</h3><span>{job.location} · {job.type} · {job.status || 'active'}</span></div></div><div className="managed-job-actions"><button className="button button-outline" onClick={() => navigate(`/dashboard/recruiter/jobs/${job._id}/edit`)}>Edit</button><button className="button button-outline" onClick={updateStatus} disabled={busy}>{job.status === 'closed' ? 'Reopen' : 'Close'}</button><button className="button button-danger" onClick={deleteJob} disabled={busy}>Delete</button></div>{error && <p className="form-error" role="alert">{error}</p>}</article>
}

function JobEditor() {
  const { jobId } = useParams()
  const { managedJobs, setManagedJobs, setJobs } = usePortal()
  const navigate = useNavigate()
  const isEdit = Boolean(jobId)
  const [loadedJob, setLoadedJob] = useState(null)
  const job = managedJobs.find((item) => item._id === jobId) || loadedJob
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const stored = managedJobs.find((item) => item._id === jobId)
    if (isEdit && !stored && !loadedJob) request(`/jobs/${jobId}/manage`).then(({ job: result }) => setLoadedJob(result)).catch((reason) => setError(reason.message))
  }, [isEdit, jobId, managedJobs, loadedJob])
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const { job: updated } = await request(isEdit ? `/jobs/${jobId}` : '/jobs', { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(values) })
      setManagedJobs((current) => isEdit ? current.map((item) => item._id === jobId ? updated : item) : [updated, ...current])
      setJobs((current) => isEdit ? current.map((item) => item._id === jobId ? updated : item) : [updated, ...current])
      navigate('/dashboard/recruiter/jobs')
    } catch (reason) { setError(reason.message) } finally { setBusy(false) }
  }
  if (isEdit && !job && !error) return <div className="loading-state"><span className="spinner" />Loading job…</div>
  return <><PageHeading eyebrow="RECRUITER WORKSPACE" title={isEdit ? 'Edit this opening.' : 'Tell the world who you need.'} subtitle="Clear, thoughtful details help the right people find you." /><form className="profile-form form-stack job-editor-form" onSubmit={submit}><div className="form-two"><label>Job title<input name="title" defaultValue={job?.title || ''} maxLength="120" required placeholder="e.g. Product designer" /></label><label>Location<input name="location" defaultValue={job?.location || ''} maxLength="120" required placeholder="e.g. Bengaluru or remote" /></label></div><div className="form-two"><label>Work type<select name="type" defaultValue={job?.type || 'Full-time'}><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option></select></label><label>Salary range<input name="salary" defaultValue={job?.salary || ''} maxLength="100" placeholder="e.g. ₹12–16 LPA" /></label></div><label>Role description<textarea name="description" defaultValue={job?.description || ''} rows="6" maxLength="5000" required placeholder="What will this person work on?" /></label><label>Skills or category<input name="category" defaultValue={job?.category || ''} maxLength="80" placeholder="e.g. Engineering, React, APIs" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Link className="button button-outline" to="/dashboard/recruiter/jobs">Cancel</Link><button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Publish opening'} <ArrowRight size={15} /></button></div></form></>
}

function RecruiterApplicantsPage() {
  const { applications, setApplications } = usePortal()
  return <><PageHeading eyebrow="RECRUITER WORKSPACE" title="Applicants." subtitle="Thoughtful hiring starts with a thoughtful review." /><ApplicationTable applications={applications} setApplications={setApplications} role="recruiter" /></>
}

function StudentDashboard() {
  const { user, applications, jobs } = usePortal()
  const savedIds = (user.savedJobs || []).map((id) => String(id?._id || id))
  const savedJobs = jobs.filter((job) => savedIds.includes(String(job._id)))
  const profileScore = Math.min(100, 40 + (user.phone ? 15 : 0) + (user.location ? 15 : 0) + (user.skills?.length ? 20 : 0) + (user.resumeName ? 10 : 0))
  return <><PageHeading eyebrow="STUDENT WORKSPACE" title={`Welcome back, ${user.name.split(' ')[0]}.`} subtitle="Keep your next move in sight." /><div className="student-overview"><Metric label="Applications sent" value={applications.length.toString().padStart(2, '0')} note="Every good thing starts somewhere" /><Metric label="In review" value={applications.filter((item) => item.status === 'In review').length.toString().padStart(2, '0')} note="Teams are taking a look" /><div className="profile-meter"><div><span>Profile strength</span><strong>{profileScore}%</strong></div><div className="meter-track"><i style={{ width: `${profileScore}%` }} /></div><Link to="/profile/student">Complete your profile <ArrowRight size={14} /></Link></div></div><section className="dashboard-section"><div className="section-heading compact"><div><span className="eyebrow">HAND-PICKED OPPORTUNITIES</span><h2>Recommended jobs<span className="heading-period">.</span></h2></div><Link className="button button-outline" to="/jobs">Browse all jobs <ArrowRight size={15} /></Link></div><div className="job-list">{jobs.slice(0, 3).map((job, index) => <JobRow key={job._id} job={job} index={index} />)}</div></section><section className="dashboard-section"><div className="section-heading compact"><div><span className="eyebrow">YOUR SEARCH, IN MOTION</span><h2>Recent applications<span className="heading-period">.</span></h2></div><Link className="section-count" to="/applications">View all <ArrowRight size={14} /></Link></div>{applications.length ? <div className="application-list">{applications.slice(0, 3).map((application) => <article className="application-row" key={application._id}><div className="company-mark">{(application.job?.companyName || 'Co').slice(0, 2).toUpperCase()}</div><div className="application-info"><h3>{application.job?.title || 'Position'}</h3><span>{application.job?.companyName || 'Company'} · Applied {new Date(application.createdAt).toLocaleDateString()}</span></div><span className={`status-pill status-${application.status?.toLowerCase().replaceAll(' ', '-')}`}><Clock3 size={13} /> {application.status}</span></article>)}</div> : <EmptyState title="Your first application starts here" text="Explore open roles and keep your progress together." />}</section><section className="dashboard-section saved-section"><div className="section-heading compact"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Saved jobs<span className="heading-period">.</span></h2></div></div>{savedJobs.length ? <div className="job-list">{savedJobs.slice(0, 3).map((job, index) => <JobRow key={job._id} job={job} index={index} />)}</div> : <p className="muted-copy">Tap the bookmark on a role to keep it close.</p>}</section></>
}

function AdminDashboard() {
  const { users, managedJobs, applications, messages } = usePortal()
  const students = users.filter((person) => person.role === 'student').length
  const recruiters = users.filter((person) => person.role === 'recruiter').length
  const recentApplications = applications.slice(0, 3)
  return <><PageHeading eyebrow="ADMIN WORKSPACE" title="The Pathway community." subtitle="A clear view of people, opportunities and messages." /><div className="admin-metrics admin-metrics-four"><Metric label="Total students" value={students.toString().padStart(2, '0')} note="Growing talent community" /><Metric label="Total recruiters" value={recruiters.toString().padStart(2, '0')} note="Hiring teams on Pathway" /><Metric label="Total jobs" value={managedJobs.length.toString().padStart(2, '0')} note="Across all employers" /><Metric label="Total applications" value={applications.length.toString().padStart(2, '0')} note="Being reviewed" /></div><div className="admin-analytics"><div className="analytics-heading"><div><span className="eyebrow">LIVE OVERVIEW</span><h2>Marketplace activity</h2></div><BarChart3 size={20} /></div><div className="analytics-bars"><AnalyticsBar label="Open roles" value={managedJobs.filter((job) => job.status === 'active').length} total={managedJobs.length} /><AnalyticsBar label="Applications in review" value={applications.filter((item) => item.status === 'In review').length} total={applications.length} /><AnalyticsBar label="Contact requests" value={messages.length} total={messages.length} /></div></div><div className="admin-shortcuts"><Link to="/dashboard/admin/users"><Users size={20} /><strong>Manage people</strong><span>Review or disable accounts</span><ArrowRight size={15} /></Link><Link to="/dashboard/admin/jobs"><BriefcaseBusiness size={20} /><strong>Manage listings</strong><span>Review or remove job posts</span><ArrowRight size={15} /></Link><Link to="/dashboard/admin/messages"><FileText size={20} /><strong>Contact messages</strong><span>{messages.length} messages to review</span><ArrowRight size={15} /></Link></div><section className="admin-activity"><div className="analytics-heading"><div><span className="eyebrow">LATEST UPDATES</span><h2>Recent applications</h2></div><Link to="/dashboard/admin/jobs">Manage listings <ArrowRight size={14} /></Link></div>{recentApplications.length ? recentApplications.map((application) => <div className="activity-row" key={application._id}><span className="activity-icon"><FileText size={15} /></span><span><strong>{application.applicant?.name || 'A candidate'}</strong> applied for <strong>{application.job?.title || 'an opening'}</strong></span><small>{new Date(application.createdAt).toLocaleDateString()}</small></div>) : <p className="muted-copy">New applications will appear here as candidates apply.</p>}</section></>
}

function AnalyticsBar({ label, value, total }) {
  const width = total ? Math.max(value ? 6 : 0, Math.round(value / total * 100)) : 0
  return <div className="analytics-row"><div><span>{label}</span><strong>{value}</strong></div><div className="analytics-track"><i style={{ width: `${width}%` }} /></div></div>
}

function AdminUsersPage() {
  const { users, setUsers } = usePortal()
  const [error, setError] = useState('')
  const updateAccess = async (person) => {
    setError('')
    try {
      const { user } = await request(`/users/${person._id}/disable`, { method: 'PATCH', body: JSON.stringify({ disabled: !person.disabled }) })
      setUsers((current) => current.map((item) => item._id === person._id ? user : item))
    } catch (reason) { setError(reason.message) }
  }
  return <><PageHeading eyebrow="ADMIN WORKSPACE" title="People." subtitle="Review student and recruiter accounts." />{error && <p className="form-error" role="alert">{error}</p>}<AdminUsers users={users} onDisable={updateAccess} /></>
}

function AdminJobsPage() {
  const { managedJobs, setManagedJobs, setJobs } = usePortal()
  const [error, setError] = useState('')
  const remove = async (job) => {
    if (!window.confirm(`Delete “${job.title}” and its applications?`)) return
    try {
      await request(`/jobs/${job._id}`, { method: 'DELETE' })
      setManagedJobs((current) => current.filter((item) => item._id !== job._id))
      setJobs((current) => current.filter((item) => item._id !== job._id))
    } catch (reason) { setError(reason.message) }
  }
  return <><PageHeading eyebrow="ADMIN WORKSPACE" title="All job listings." subtitle="Review listings across every employer." />{error && <p className="form-error" role="alert">{error}</p>}<div className="admin-list">{managedJobs.map((job) => <article key={job._id} className="admin-list-row"><div><strong>{job.title}</strong><span>{job.companyName} · {job.location} · {job.status}</span></div><button className="button button-danger" onClick={() => remove(job)}>Delete listing</button></article>)}{!managedJobs.length && <EmptyState title="No job listings yet" text="Listings from recruiters will appear here." />}</div></>
}

function AdminMessagesPage() {
  const { messages } = usePortal()
  return <><PageHeading eyebrow="ADMIN WORKSPACE" title="Contact messages." subtitle="Messages sent through the Pathway contact form." /><div className="admin-list">{messages.map((message) => <article key={message._id} className="message-row"><span className="eyebrow">{new Date(message.createdAt).toLocaleDateString()}</span><h3>{message.subject}</h3><p>{message.message}</p><span>{message.name} · <a href={`mailto:${message.email}`}>{message.email}</a></span></article>)}{!messages.length && <EmptyState title="No messages yet" text="New contact requests will appear here." />}</div></>
}

function ApplicationsPage() {
  const { applications } = usePortal()
  return <><PageHeading eyebrow="STUDENT WORKSPACE" title="Your applications." subtitle="A clear view of where every opportunity stands." /><ApplicationTable applications={applications} role="student" /></>
}

function ProfilePage() {
  const { user, setUser } = usePortal()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false)
    const formData = new FormData(event.currentTarget)
    formData.set('skills', formData.get('skills').split(',').map((skill) => skill.trim()).filter(Boolean).join(','))
    try { const { user: updated } = await request('/users/me', { method: 'PATCH', body: formData }); setUser(updated); setSaved(true) }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  return <><PageHeading eyebrow={`${user.role.toUpperCase()} PROFILE`} title={user.role === 'student' ? 'A little more about you.' : 'Your company profile.'} subtitle="The right details help the right people find you." /><ProfileForm user={user} onSave={submit} busy={busy} error={error} saved={saved} /></>
}

function ContactPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('')
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    try { const result = await request('/contact', { method: 'POST', body: JSON.stringify(values) }); setSuccess(result.message); form.reset() }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  return <section className="contact-page"><div className="contact-copy"><span className="eyebrow"><span className="eyebrow-dot" /> WE’RE HERE TO HELP</span><h1>Let’s talk about<br /><em>what’s next.</em></h1><p>Questions about your account, a job listing or finding the right people? Send us a note and our team will get back to you.</p><div className="contact-detail"><span>CONTACT OUR TEAM</span><strong>Send us a message using the form.</strong></div></div><form className="profile-form form-stack contact-form" onSubmit={submit}><div className="form-two"><label>Your name<input name="name" required maxLength="100" autoComplete="name" /></label><label>Email address<input name="email" type="email" required autoComplete="email" /></label></div><label>Subject<input name="subject" required maxLength="160" placeholder="What can we help with?" /></label><label>Your message<textarea name="message" required rows="6" maxLength="3000" placeholder="Tell us a little more…" /></label>{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="success-message" role="status"><Check size={16} />{success}</p>}<button className="button button-dark" disabled={busy}>{busy ? 'Sending…' : 'Send message'} <ArrowRight size={15} /></button></form></section>
}

function AboutPage() {
  return <><section className="about-hero"><span className="eyebrow"><span className="eyebrow-dot" /> A MORE HUMAN WAY TO WORK</span><h1>Good work changes<br />what comes <em>next.</em></h1><p>Pathway brings early-career talent and thoughtful teams together, so finding your first opportunity can feel like a beginning, not a maze.</p></section><section className="about-columns"><article><span>01 / WHY WE’RE HERE</span><h2>First steps deserve care.</h2><p>Starting a career is full of possibility and uncertainty. We make the search clearer with opportunities that are easy to explore and people who are ready to meet you where you are.</p></article><article><span>02 / WHAT WE BELIEVE</span><h2>Good work goes both ways.</h2><p>Strong teams are built when people and employers can find each other honestly. Clear roles, useful profiles and a human application process help both sides make better choices.</p></article><article><span>03 / WHERE WE’RE GOING</span><h2>More room to grow.</h2><p>We’re building a place where students can take confident next steps and recruiters can meet the next generation of builders.</p><Link className="text-link-button" to="/jobs">Explore open roles <ArrowRight size={15} /></Link></article></section><section className="bottom-cta"><div><span className="eyebrow">READY WHEN YOU ARE</span><h2>Your next chapter starts <em>here.</em></h2></div><Link className="button button-light" to="/register/student">Join Pathway <ArrowRight size={16} /></Link></section></>
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot" /> {eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-actions">{action}</div>}</div>
}

function Metric({ label, value, note }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}

function JobFilters({ query, setQuery, location, setLocation, typeFilter, setTypeFilter }) {
  return <div className="filter-bar"><label><Search size={17} /><input placeholder="Search roles or skills" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label><MapPin size={17} /><input placeholder="Location" value={location} onChange={(event) => setLocation(event.target.value)} /></label><label className="filter-select"><Filter size={16} /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All types</option><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option></select><ChevronDown size={14} /></label><span className="filter-label">NEWEST FIRST <ArrowDown size={13} /></span></div>
}

function JobRow({ job, index = 0 }) {
  const { user, toggleSavedJob } = usePortal()
  const navigate = useNavigate()
  const [saveError, setSaveError] = useState('')
  const initials = (job.companyName || 'Co').split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()
  const saved = (user?.savedJobs || []).some((id) => String(id?._id || id) === String(job._id))
  const save = async () => {
    setSaveError('')
    if (!user) return navigate('/login/student', { state: { from: '/jobs' } })
    if (user.role !== 'student') return setSaveError('Saved jobs are available to student accounts.')
    try { await toggleSavedJob(job) } catch (reason) { setSaveError(reason.message) }
  }
  return <article className="job-row" style={{ '--row-index': index }}><div className={`company-mark mark-${index % 4}`}>{initials}</div><div className="job-main"><div className="job-title-line"><h3>{job.title}</h3><span className="new-badge">{job.status === 'closed' ? 'CLOSED' : 'NEW'}</span></div><div className="job-meta"><span><Building2 size={14} />{job.companyName}</span><span><MapPin size={14} />{job.location}</span><span><BriefcaseBusiness size={14} />{job.type}</span></div><p>{job.description}</p><div className="job-tags">{(job.tags || (job.category ? [job.category] : [])).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>{saveError && <span className="save-error" role="status">{saveError}</span>}</div><div className="job-end"><strong>{job.salary || 'Compensation shared during interview'}</strong><span>{job.category || job.type}</span><Link className="button button-outline" to={`/jobs/${job._id}`}>View role <ArrowRight size={15} /></Link></div><button className={`save-job ${saved ? 'is-saved' : ''}`} aria-label={saved ? 'Remove saved job' : 'Save job'} aria-pressed={saved} title={saved ? 'Remove saved job' : 'Save job'} onClick={save}>{saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button></article>
}

function ApplicationTable({ applications, role, setApplications }) {
  const [error, setError] = useState('')
  const update = async (id, status) => {
    try {
      const { application } = await request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setApplications((current) => current.map((item) => item._id === id ? { ...item, status: application.status } : item))
    } catch (reason) { setError(reason.message) }
  }
  const download = async (application) => {
    try {
      const response = await fetch(`${API_BASE_URL}/applications/${application._id}/resume`, { headers: { Authorization: `Bearer ${localStorage.getItem('pathway-token')}` } })
      if (!response.ok) throw new Error('Resume could not be downloaded.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = application.resumeName || 'candidate-resume'; link.click(); URL.revokeObjectURL(url)
    } catch (reason) { setError(reason.message) }
  }
  if (!applications.length) return <EmptyState title="No applications here yet" text={role === 'student' ? 'When a role catches your eye, apply and we’ll keep everything organized here.' : 'As candidates apply, their details will show up here.'} />
  return <div className="application-list">{error && <p className="form-error" role="alert">{error}</p>}{applications.map((application) => <article className="application-row" key={application._id}><div className="company-mark mark-1">{(application.job?.companyName || 'Co').slice(0, 2).toUpperCase()}</div><div className="application-info"><h3>{application.job?.title || 'Position'}</h3><span>{application.job?.companyName || 'Company'} · {new Date(application.createdAt).toLocaleDateString()}</span>{role !== 'student' && <p>{application.applicant?.name} · {application.applicant?.email}</p>}</div><span className={`status-pill status-${application.status?.toLowerCase().replaceAll(' ', '-')}`}>{application.status}</span>{role !== 'student' && <><button className="download-resume" onClick={() => download(application)}><FileText size={16} /> Resume</button><select aria-label="Update application status" value={application.status} onChange={(event) => update(application._id, event.target.value)}><option>Submitted</option><option>In review</option><option>Interview</option><option>Offer</option><option>Rejected</option></select></>}</article>)}</div>
}

function ProfileForm({ user, onSave, busy, error, saved }) {
  const [resumeError, setResumeError] = useState('')
  const downloadResume = async () => {
    setResumeError('')
    try {
      const response = await fetch(`${API_BASE_URL}/users/me/resume`, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (!response.ok) throw new Error('Resume could not be downloaded.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = user.resumeName || 'resume'; link.click(); URL.revokeObjectURL(url)
    } catch (reason) { setResumeError(reason.message) }
  }
  return <form className="profile-form form-stack" onSubmit={onSave}><div className="profile-header"><div className="profile-avatar">{user.name?.slice(0, 1).toUpperCase()}</div><div><h2>{user.name}</h2><span>{user.email} · {user.role}</span></div></div><div className="form-two"><label>Full name<input name="name" defaultValue={user.name} maxLength="100" required /></label><label>{user.role === 'student' ? 'Professional headline' : 'Company name'}<input name={user.role === 'student' ? 'headline' : 'companyName'} defaultValue={user.headline || user.companyName || ''} placeholder={user.role === 'student' ? 'e.g. Computer science student' : 'Your company'} /></label></div><div className="form-two"><label>Phone<input name="phone" type="tel" defaultValue={user.phone || ''} maxLength="30" autoComplete="tel" /></label><label>Location<input name="location" defaultValue={user.location || ''} placeholder="City, country or remote" /></label></div><label>Skills <span className="label-hint">(comma separated)</span><input name="skills" defaultValue={(user.skills || []).join(', ')} placeholder="React, writing, product" /></label><label>About<textarea name="bio" rows="5" defaultValue={user.bio || ''} maxLength="1500" placeholder="What kind of work matters to you?" /></label>{user.role === 'student' && <div className="profile-resume"><FileText size={19} /><span>{user.resumeName ? `Current resume: ${user.resumeName}` : 'No resume on your profile yet.'}</span>{user.resumeName && <button className="button button-outline" type="button" onClick={downloadResume}>Download</button>}<input name="resume" type="file" accept=".pdf,.doc,.docx" aria-label="Upload replacement resume" /></div>}{(error || resumeError) && <p className="form-error" role="alert">{error || resumeError}</p>}{saved && <p className="success-message" role="status"><Check size={16} /> Profile saved.</p>}<button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Check size={15} /></button></form>
}

function AdminUsers({ users, onDisable }) {
  return <div className="application-list">{users.filter((person) => person.role !== 'admin').map((person) => <article className="application-row" key={person._id}><div className="company-mark mark-2">{person.name?.slice(0, 1)}</div><div className="application-info"><h3>{person.name}{person.disabled && ' · Disabled'}</h3><span>{person.email} · {person.location || 'Location not set'}</span></div><span className="role-pill">{person.role}</span><button className="job-status-action" onClick={() => onDisable(person)}>{person.disabled ? 'Restore access' : 'Disable access'}</button></article>)}</div>
}

function EmptyState({ title, text, children }) {
  return <div className="empty-state"><Search size={26} /><h3>{title}</h3><p>{text}</p>{children}</div>
}

function SiteFooter() {
  return <footer className="site-footer"><span>© 2025 Pathway. Good work starts somewhere.</span><span><Link to="/about">About</Link> · <Link to="/contact">Contact</Link> · <Link to="/login/admin">Admin</Link></span></footer>
}

function NotFoundPage() {
  return <EmptyState title="We couldn’t find that page." text="The link may have changed, but there are still good opportunities ahead."><Link className="button button-dark" to="/">Back to home <ArrowRight size={15} /></Link></EmptyState>
}

function TermsPage() {
  return <><PageHeading eyebrow="PATHWAY POLICIES" title="Terms and privacy." subtitle="A clear, respectful foundation for your next move." /><section className="terms-page"><article><span>01 / USING PATHWAY</span><h2>Use the platform thoughtfully.</h2><p>Pathway helps students explore opportunities and helps recruiters connect with candidates. Keep your account information accurate, use the platform lawfully, and do not impersonate another person or organization.</p></article><article><span>02 / JOBS AND APPLICATIONS</span><h2>Make every listing and application genuine.</h2><p>Recruiters are responsible for the accuracy of their job listings. Students should apply only with information and documents they have permission to share. Application materials are made available to the applicant and the hiring team for that role.</p></article><article><span>03 / YOUR INFORMATION</span><h2>Your profile stays in your control.</h2><p>Pathway stores account, profile, job, and application information to provide the service. You can update your profile, manage saved jobs, or request account assistance through the contact page. Passwords are stored as hashes; resume files are restricted to the applicant, the relevant recruiter, and administrators.</p></article><article><span>04 / ACCOUNT SECURITY</span><h2>Keep your account secure.</h2><p>Choose a strong password and keep your sign-in details private. Administrators may disable accounts that misuse the platform or violate these terms. Password reset links expire after one hour.</p></article><Link className="button button-outline" to="/contact">Questions? Contact Pathway <ArrowRight size={15} /></Link></section></>
}