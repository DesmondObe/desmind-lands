/**
 * Where DesMind Lands operates. Launch is Enugu State only; to open another state, add it here
 * with its local government areas (and the same in frontend/src/lib/land.ts). Listings can only
 * be made, and the market only shows land, in these states.
 */
export const SERVED: Record<string, readonly string[]> = {
  Enugu: [
    "Aninri",
    "Awgu",
    "Enugu East",
    "Enugu North",
    "Enugu South",
    "Ezeagu",
    "Igbo Etiti",
    "Igbo Eze North",
    "Igbo Eze South",
    "Isi Uzo",
    "Nkanu East",
    "Nkanu West",
    "Nsukka",
    "Oji River",
    "Udenu",
    "Udi",
    "Uzo-Uwani",
  ],
};

export const SERVED_STATES = Object.keys(SERVED) as [string, ...string[]];
