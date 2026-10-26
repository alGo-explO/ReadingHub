import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

const emptyProfile = {
  name: '',
  avatar: '',
  bio: '',
  location: '',
  website: '',
  readingGoal: 12,
  isPublic: false
};

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1a535c] focus:ring-4 focus:ring-[#1a535c]/10 disabled:bg-slate-100';

function ProfileAvatar({ user, size = 'large' }) {
  const [failed, setFailed] = useState(false);
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
  const dimensions = size === 'large' ? 'h-28 w-28 text-4xl' : 'h-16 w-16 text-2xl';

  useEffect(() => setFailed(false), [user.avatar]);

  if (user.avatar && !failed) {
    return (
      <img
        src={user.avatar}
        alt={`${user.name || 'User'} profile`}
        onError={() => setFailed(true)}
        className={`${dimensions} rounded-2xl border-4 border-white/30 object-cover shadow-xl`}
      />
    );
  }

  return (
    <div className={`${dimensions} flex items-center justify-center rounded-2xl border border-white/20 bg-white/15 font-bold text-white shadow-xl backdrop-blur-sm`} aria-label={`${user.name || 'User'} initial`}>
      {initial}
    </div>
  );
}

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [formData, setFormData] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const setProfileState = (profile) => {
    setUser(profile);
    setFormData({
      name: profile.name || '',
      avatar: profile.avatar || '',
      bio: profile.bio || '',
      location: profile.location || '',
      website: profile.website || '',
      readingGoal: profile.readingGoal || 12,
      isPublic: profile.isPublic === true
    });
  };

  const handleAuthFailure = (response) => {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token');
      navigate('/login', { replace: true });
      return true;
    }
    return false;
  };

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const [profileResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/api/auth/profile`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/analytics/stats?timeframe=year`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (handleAuthFailure(profileResponse)) return;
      if (!profileResponse.ok) {
        const data = await profileResponse.json().catch(() => ({}));
        throw new Error(data.error || 'Unable to load your profile.');
      }

      setProfileState(await profileResponse.json());
      if (statsResponse.ok) setStats(await statsResponse.json());
    } catch (fetchError) {
      setError(fetchError.message || 'Unable to load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const isDirty = useMemo(() => {
    if (!user) return false;
    return formData.name !== (user.name || '') ||
      formData.avatar !== (user.avatar || '') ||
      formData.bio !== (user.bio || '') ||
      formData.location !== (user.location || '') ||
      formData.website !== (user.website || '') ||
      Number(formData.readingGoal) !== (user.readingGoal || 12) ||
      formData.isPublic !== (user.isPublic === true);
  }, [formData, user]);

  const updateField = (name, value) => {
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const validate = () => {
    if (formData.name.trim().length > 100) return 'Name must be 100 characters or fewer.';
    if (formData.bio.length > 1000) return 'Bio must be 1,000 characters or fewer.';
    if (formData.location.length > 150) return 'Location must be 150 characters or fewer.';

    const readingGoal = Number(formData.readingGoal);
    if (!Number.isInteger(readingGoal) || readingGoal < 1 || readingGoal > 1000) {
      return 'Reading goal must be a whole number between 1 and 1,000.';
    }

    if (formData.website) {
      try {
        const url = new URL(formData.website);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch (_error) {
        return 'Website must be a valid HTTP or HTTPS URL.';
      }
    }

    if (formData.avatar) {
      try {
        if (new URL(formData.avatar).protocol !== 'https:') throw new Error();
      } catch (_error) {
        return 'Profile image must be a valid HTTPS URL.';
      }
    }
    return '';
  };

  const updateProfile = async (event) => {
    event.preventDefault();
    if (saving || !isDirty) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          name: formData.name.trim(),
          avatar: formData.avatar.trim(),
          bio: formData.bio.trim(),
          location: formData.location.trim(),
          website: formData.website.trim(),
          readingGoal: Number(formData.readingGoal)
        })
      });

      if (handleAuthFailure(response)) return;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save your profile.');

      setProfileState(data);
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: data }));
      setEditing(false);
      setSuccess('Profile updated successfully.');
      setStats((previous) => previous ? { ...previous, yearlyGoal: data.readingGoal } : previous);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    if (user) setProfileState(user);
    setError('');
    setEditing(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-64 rounded-3xl bg-slate-200" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="h-64 rounded-2xl bg-slate-200 lg:col-span-2" />
            <div className="h-64 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">Profile unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button onClick={fetchProfile} className="mt-6 rounded-xl bg-[#1a535c] px-5 py-2.5 font-semibold text-white hover:bg-[#13434a]">Try again</button>
        </div>
      </main>
    );
  }

  const goal = user.readingGoal || 12;
  const completed = stats?.booksCompletedThisYear || 0;
  const goalProgress = Math.min(100, Math.round((completed / goal) * 100));
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : 'Recently';

  return (
    <main className="min-h-screen bg-slate-50 pb-14">
      <section className="bg-gradient-to-br from-[#123d43] via-[#1a535c] to-[#2e7379] text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ProfileAvatar user={user} />
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">{user.isPublic ? 'Public profile' : 'Private profile'}</span>
                  <span className="text-xs text-white/70">Member since {memberSince}</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{user.name || 'Reader'}</h1>
                <p className="mt-1 text-white/75">{user.email}</p>
                {user.location && <p className="mt-2 text-sm text-white/85">📍 {user.location}</p>}
              </div>
            </div>
            {!editing && (
              <button onClick={() => { setEditing(true); setSuccess(''); }} className="rounded-xl bg-white px-5 py-2.5 font-bold text-[#1a535c] shadow-sm transition hover:bg-slate-100">
                Edit profile
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {(error || success) && (
          <div role={error ? 'alert' : 'status'} className={`mt-6 rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {error || success}
          </div>
        )}

        {editing ? (
          <form onSubmit={updateProfile} className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <fieldset disabled={saving} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm disabled:opacity-70 sm:p-8">
              <div className="mb-7">
                <h2 className="text-xl font-bold text-slate-950">Personal details</h2>
                <p className="mt-1 text-sm text-slate-500">Keep your reading identity and goal up to date.</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold text-slate-700">Display name</label>
                  <input id="profile-name" value={formData.name} onChange={(event) => updateField('name', event.target.value)} className={inputClass} maxLength="100" placeholder="Your name" autoFocus />
                </div>
                <div>
                  <label htmlFor="profile-location" className="mb-2 block text-sm font-semibold text-slate-700">Location</label>
                  <input id="profile-location" value={formData.location} onChange={(event) => updateField('location', event.target.value)} className={inputClass} maxLength="150" placeholder="City, Country" />
                </div>
                <div className="sm:col-span-2">
                  <div className="mb-2 flex justify-between gap-4">
                    <label htmlFor="profile-bio" className="text-sm font-semibold text-slate-700">Bio</label>
                    <span className="text-xs text-slate-400">{formData.bio.length}/1000</span>
                  </div>
                  <textarea id="profile-bio" value={formData.bio} onChange={(event) => updateField('bio', event.target.value)} className={inputClass} rows="5" maxLength="1000" placeholder="Share what you enjoy reading…" />
                </div>
                <div>
                  <label htmlFor="profile-website" className="mb-2 block text-sm font-semibold text-slate-700">Website</label>
                  <input id="profile-website" type="url" value={formData.website} onChange={(event) => updateField('website', event.target.value)} className={inputClass} maxLength="500" placeholder="https://example.com" />
                </div>
                <div>
                  <label htmlFor="profile-avatar" className="mb-2 block text-sm font-semibold text-slate-700">Profile image URL</label>
                  <input id="profile-avatar" type="url" value={formData.avatar} onChange={(event) => updateField('avatar', event.target.value)} className={inputClass} maxLength="2000" placeholder="https://example.com/photo.jpg" />
                  <p className="mt-2 text-xs text-slate-500">Use a public HTTPS image URL.</p>
                </div>
                <div>
                  <label htmlFor="profile-goal" className="mb-2 block text-sm font-semibold text-slate-700">Annual reading goal</label>
                  <div className="relative">
                    <input id="profile-goal" type="number" value={formData.readingGoal} onChange={(event) => updateField('readingGoal', event.target.value)} className={`${inputClass} pr-20`} min="1" max="1000" />
                    <span className="pointer-events-none absolute right-4 top-3.5 text-sm text-slate-400">books</span>
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <span>
                      <span className="block text-sm font-bold text-slate-900">Public profile</span>
                      <span className="mt-1 block text-xs text-slate-500">Allow others to discover your profile.</span>
                    </span>
                    <input type="checkbox" checked={formData.isPublic} onChange={(event) => updateField('isPublic', event.target.checked)} className="h-5 w-5 rounded border-slate-300 accent-[#1a535c]" />
                  </label>
                </div>
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                <button type="button" onClick={cancelEditing} disabled={saving} className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving || !isDirty} className="rounded-xl bg-[#1a535c] px-6 py-2.5 font-semibold text-white transition hover:bg-[#13434a] disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </fieldset>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl bg-[#1a535c] p-6 text-center text-white shadow-sm">
                <div className="flex justify-center"><ProfileAvatar user={{ ...user, name: formData.name, avatar: formData.avatar }} size="small" /></div>
                <p className="mt-3 font-bold">{formData.name.trim() || 'Reader'}</p>
                <p className="mt-1 text-xs text-white/70">Profile preview</p>
              </div>
              <p className="px-2 text-center text-xs leading-5 text-slate-500">Your email address is private and cannot be changed here.</p>
            </aside>
          </form>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 sm:p-8">
              <h2 className="text-lg font-bold text-slate-950">About</h2>
              <p className={`mt-3 leading-7 ${user.bio ? 'text-slate-600' : 'italic text-slate-400'}`}>{user.bio || 'No bio yet. Add a few words about your reading interests.'}</p>

              <div className="mt-8 grid gap-5 border-t border-slate-100 pt-7 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Location</p>
                  <p className="mt-2 font-medium text-slate-800">{user.location || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Website</p>
                  {/^https?:\/\//i.test(user.website || '') ? (
                    <a href={user.website} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate font-medium text-[#1a535c] hover:underline">{user.website}</a>
                  ) : <p className="mt-2 font-medium text-slate-800">Not provided</p>}
                </div>
              </div>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{new Date().getFullYear()} goal</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{completed} <span className="text-base font-medium text-slate-400">/ {goal} books</span></p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1a535c]/10 text-sm font-bold text-[#1a535c]">{goalProgress}%</div>
              </div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#1a535c] transition-all" style={{ width: `${goalProgress}%` }} />
              </div>
              <p className="mt-3 text-xs text-slate-500">{completed >= goal ? 'Goal achieved—wonderful work!' : `${Math.max(0, goal - completed)} books to reach your goal.`}</p>

              <div className="mt-7 grid grid-cols-3 gap-2 border-t border-slate-100 pt-6 text-center">
                <div><p className="text-lg font-bold text-slate-950">{stats?.totalBooks ?? '—'}</p><p className="text-xs text-slate-500">Library</p></div>
                <div><p className="text-lg font-bold text-slate-950">{stats?.pagesRead ?? '—'}</p><p className="text-xs text-slate-500">Pages</p></div>
                <div><p className="text-lg font-bold text-slate-950">{stats?.readingTime ?? '—'}</p><p className="text-xs text-slate-500">Hours</p></div>
              </div>
              <Link to="/analytics" className="mt-6 block rounded-xl bg-slate-100 px-4 py-2.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-200">View analytics</Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export default Profile;
