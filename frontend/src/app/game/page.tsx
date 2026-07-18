"use client";

import { useState } from "react";
import PreLoader from "../../components/PreLoader";
import StoryCutscene from "../../components/StoryCutscene";
import CharacterSelect from "../../components/CharacterSelection";
import { availableMemory } from "process";  
import { arrayBuffer } from "stream/consumers";

export default function GamePage() {
  const [stage, setStage] = useState(0);

  // 0 = loading
  // 1 = story
  // 2 = character select

  if (stage === 0)
    return <PreLoader onComplete={() => setStage(1)} />;

  if (stage === 1)
    return <StoryCutscene onComplete={() => setStage(2)} />;

  return (
    <CharacterSelect
      userId={1}
      onSelect={(role) => {
        console.log("Seçilen rol:", role);
        alert("Game started as: " + role);
      }}
    />
  );
}
