"use client";
import classNames from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderIcon, RefreshCcw } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

type Service = {
  port: number;
  title: string;
  url: string;
  favicon: string | null;
};

const getInitials = (name: string) =>
  name ? name.substring(0, 2).toUpperCase() : "??";

const getGradient = (id: number) => {
  const gradients = [
    "from-pink-500 to-rose-500",
    "from-purple-500 to-indigo-500",
    "from-blue-400 to-cyan-400",
    "from-emerald-400 to-teal-500",
    "from-orange-400 to-amber-400",
  ];
  return gradients[id % gradients.length];
};

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Connected to WebSocket");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setServices(data);
        setLoading(false);
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, []);

  const scanNetwork = () => {
    // Optional: Send a message to server to request immediate scan
    // For now, the server scans periodically, so we might not need this button to do anything
    // or we could implement a message type to trigger scan.
    // But the user asked to remove the need to click refresh.
    // We can keep the button as a visual indicator or trigger a re-connect if needed.
    // Let's just log for now or maybe trigger a manual fetch if we wanted to keep the API route,
    // but we are moving to WS.
    // Actually, let's just leave it empty or remove the button functionality.
    // The server sends an immediate scan on connect.
    window.location.reload(); // Simple fallback for "refresh" button if they really want to force it
  };

  return (
    <main
      className={classNames(
        "min-h-screen bg-[#f2f2ed] text-slate-800 p-8 font-sans",
        "flex flex-col items-center justify-center"
      )}
    >
      <div className="w-full max-w-6xl flex justify-between items-center mb-12 mt-4">
        <button
          onClick={scanNetwork}
          className={classNames(
            "fixed top-4 right-4 rounded-full font-medium transition-all active:scale-95 shadow-lg",
            "bg-black hover:bg-slate-800 text-white size-14 flex items-center justify-center"
          )}
        >
          <AnimatePresence mode="popLayout">
            {loading ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <LoaderIcon className="animate-spin" />
              </motion.span>
            ) : (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <RefreshCcw />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-20">
        <AnimatePresence mode="popLayout">
          {loading &&
           <motion.div  className={classNames("w-full h-full flex items-center justify-center","col-span-1 sm:col-span-2 md:col-span-3")}><LoaderIcon className="animate-spin size-20" /></motion.div>
            }

          {!loading && services.length === 0 && (
            <div className="col-span-full text-center py-20">
              <p className="text-xl text-slate-400 font-medium">
                No active services found.
              </p>
            </div>
          )}

          {!loading &&
            services.map((service, idx) => (
              <motion.a
                key={service.port}
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className={classNames(
                  "group relative block w-full aspect-square rounded-2xl",
                  "transition-shadow shadow-xl hover:shadow-2xl"
                )}
                initial={{ opacity: 0, scale: 0.8 }}
                exit={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
              >
                {/* --- BACK LAYER (Yellow Reveal) --- */}
                {/* Now holds the TITLE text aligned to bottom-right */}
                <div
                  className={classNames(
                    "absolute inset-0 bg-[#E6FF57] rounded-2xl flex flex-col",
                    "justify-end items-end p-4 px-6 transition-transform shadow-inner"
                  )}
                >
                  <div className="text-right w-full">
                    <h3 className="text-xl font-bold text-black leading-none truncate">
                      {service.title}
                    </h3>
                    <h4
                      className={classNames(
                        "text-sm text-black/20 absolute -rotate-90 origin-top-left",
                        "-bottom-5 w-full text-right px-4 left-[90%] font-mono"
                      )}
                    >
                      {service.url}
                    </h4>
                  </div>
                </div>

                {/* --- FRONT LAYER (Dark Card) --- */}
                <div
                  className={classNames(
                    "absolute inset-0 bg-[#1C1C1E] rounded-2xl p-6 flex flex-col items-center justify-center",
                    "text-center border border-slate-800 shadow-2xl transition-all duration-300 ease-[cubic-bezier(.7,0,.3,1)]",
                    "group-hover:-translate-y-12 group-hover:-translate-x-12 group-hover:shadow-black/20"
                  )}
                >
                  {/* Badge (Port) */}
                  <div className="absolute top-8 right-8">
                    <div className="bg-white/10 backdrop-blur-md text-white/60 text-xs font-mono px-3 py-1 rounded-full border border-white/5">
                      :{service.port}
                    </div>
                  </div>

                  {/* FAVICON CIRCLE (Action Button) */}
                  <div className="absolute bottom-6 right-6 z-20">
                    <div
                      className={classNames(
                        "h-12 w-12 rounded-full bg-[#E6FF57] flex items-center justify-center shadow-lg",
                        "shadow-black/50 overflow-hidden p-2 group-hover:scale-110 transition-transform"
                      )}
                    >
                      {service.favicon ? (
                        <Image
                          src={service.favicon}
                          alt="icon"
                          width={48}
                          height={48}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            // Fallback if favicon 404s
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML =
                                '<div class="w-3 h-3 bg-black rounded-full animate-pulse" />';
                            }
                          }}
                        />
                      ) : (
                        <div className="w-3 h-3 bg-black rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Center Avatar (Initials) */}
                  <div
                    className={`w-32 h-32 rounded-full bg-linear-to-br ${getGradient(
                      service.port
                    )} flex items-center justify-center shadow-2xl shadow-black/50 group-hover:scale-95 transition-transform duration-300`}
                  >
                    <span className="text-4xl font-bold text-white drop-shadow-md">
                      {getInitials(service.title)}
                    </span>
                  </div>
                </div>
              </motion.a>
            ))}
        </AnimatePresence>
      </div>
    </main>
  );
}
