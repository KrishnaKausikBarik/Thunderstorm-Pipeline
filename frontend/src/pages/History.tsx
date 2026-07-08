import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, Calendar, Download, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface RunData {
  id: string;
  createdAt: number;
  filename: string;
  downloadUrl: string;
  rowCount: number;
  features: string[];
}

export default function History() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isLight = theme === 'light';

  useEffect(() => {
    if (!currentUser) return;

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'runs'),
          where('uid', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const data: RunData[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as RunData);
        });
        
        setRuns(data);
      } catch (err: any) {
        console.error("Error fetching history:", err);
        // Note: Firestore requires a composite index for where() + orderBy() on different fields.
        // It might throw an error with a link to create it. We can fallback to fetching without order and sorting locally.
        try {
          const qFallback = query(collection(db, 'runs'), where('uid', '==', currentUser.uid));
          const snapshot = await getDocs(qFallback);
          const data: RunData[] = [];
          snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as RunData));
          data.sort((a, b) => b.createdAt - a.createdAt);
          setRuns(data);
        } catch (e) {
          setError('Failed to fetch run history.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [currentUser]);

  return (
    <div className="min-h-screen pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto selection:bg-accentPrimary selection:text-white relative z-10">
      
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accentPrimary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accentSecondary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex items-center gap-4 mb-10 animate-fade-in">
        <div className="p-3 bg-accentPrimary/10 border border-accentPrimary/30 rounded-xl text-accentPrimary shadow-neon-primary">
          <Database className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gradient-brand uppercase tracking-widest">
            Saved History
          </h1>
          <p className="text-sm text-gray-400 mt-1">Access your previous pipeline datasets</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 text-accentPrimary animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-accentRed/10 border border-accentRed/30 rounded-2xl flex items-center gap-3 text-accentRed">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="font-bold">{error}</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl border border-borderGlow flex flex-col items-center">
          <div className="w-16 h-16 bg-black/10 rounded-full flex items-center justify-center mb-4">
            <Database className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Past Runs</h3>
          <p className="text-gray-400">You haven't completed any pipeline runs yet. Head over to the Dashboard to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up">
          {runs.map((run) => (
            <div key={run.id} className="glass-panel p-6 rounded-2xl border border-borderGlow hover:border-accentPrimary/50 transition-all hover:-translate-y-1 hover:shadow-neon-primary group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-gray-300 text-xs font-bold uppercase tracking-wider bg-black/10 px-3 py-1.5 rounded-lg border border-borderBg">
                  <Calendar className="w-3.5 h-3.5 text-accentSecondary" />
                  {new Date(run.createdAt).toLocaleDateString()}
                </div>
                <span className="text-xs font-bold text-gray-500 bg-black/10 px-2 py-1 rounded border border-white/10">
                  {run.rowCount.toLocaleString()} rows
                </span>
              </div>
              
              <h4 className="text-white font-bold mb-2 break-words">{run.filename}</h4>
              
              <div className="flex-1">
                <p className="text-xs text-gray-400 line-clamp-2">
                  <span className="font-bold text-gray-300">Features:</span> {run.features.join(', ')}
                </p>
              </div>
              
              <div className="mt-6 pt-4 border-t border-white/10">
                <a 
                  href={run.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center justify-center gap-2 py-2.5 border border-accentPrimary/30 text-accentPrimary rounded-xl transition-all font-bold text-xs uppercase tracking-wider ${
                    isLight
                      ? 'bg-white/80 hover:bg-accentPrimary hover:text-white shadow-sm'
                      : 'bg-accentPrimary/10 hover:bg-accentPrimary hover:text-white'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Download Dataset
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
