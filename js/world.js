export class WorldMapSystem {
  static getBookLocations(book) {
    if (Array.isArray(book?.locations) && book.locations.length > 0) {
      return book.locations;
    }

    const quests = Array.isArray(book?.quests) ? book.quests : [];
    if (quests.length > 0) {
      const generated = [];
      quests.forEach((quest, qIdx) => {
        (quest.chapters || []).forEach((chap, cIdx) => {
          generated.push({
            id: `loc-${quest.id || qIdx}-${chap.id || cIdx}`,
            name: chap.title,
            region: `${quest.title || 'Quest'} • ${book?.title || 'Tamriel'}`,
            description: quest.description || `Viajar para ${chap.title}.`,
            questIndex: qIdx,
            chapterIndex: cIdx,
            blockId: chap.startBlock,
            requiredQuest: qIdx,
            requiredChapter: cIdx
          });
        });
      });
      return generated;
    }

    return (book?.chapters || []).map((chap, idx) => ({
      id: `loc-${chap.id || idx}`,
      name: chap.title,
      region: book?.title || 'Tamriel',
      description: `Viajar para ${chap.title}.`,
      questIndex: 0,
      chapterIndex: idx,
      blockId: chap.startBlock,
      requiredQuest: 0,
      requiredChapter: idx
    }));
  }

  static getLocationById(book, locationId) {
    const locations = this.getBookLocations(book);
    return locations.find((loc) => loc.id === locationId) || null;
  }

  static resolveCurrentLocationId(book, state) {
    const locations = this.getBookLocations(book);
    if (!locations.length) return null;

    if (state?.locationId) {
      const exact = locations.find((loc) => loc.id === state.locationId);
      if (exact) return exact.id;
    }

    const qIdx = state?.questIndex ?? 0;
    const cIdx = state?.chapterIndex ?? 0;

    const byQuestChapterAndBlock = locations.find(
      (loc) =>
        (loc.questIndex ?? 0) === qIdx &&
        loc.chapterIndex === cIdx &&
        loc.blockId === state?.blockId
    );
    if (byQuestChapterAndBlock) return byQuestChapterAndBlock.id;

    const byQuestAndChapter = locations.find(
      (loc) => (loc.questIndex ?? 0) === qIdx && loc.chapterIndex === cIdx
    );
    if (byQuestAndChapter) return byQuestAndChapter.id;

    const byChapter = locations.find((loc) => loc.chapterIndex === cIdx);
    return byChapter ? byChapter.id : locations[0].id;
  }

  static evaluateTravelAvailability(location, state) {
    const unlockedQuest = state?.unlockedQuest ?? 0;
    const currentQuest = state?.questIndex ?? 0;
    const targetQuest = location.questIndex ?? currentQuest;
    const unlockedChapter = state?.unlockedChapters?.[targetQuest] ??
      (targetQuest === currentQuest ? state?.unlockedChapter ?? 0 : 0);
    const level = state?.progression?.level ?? 1;
    const inventory = Array.isArray(state?.inventory) ? state.inventory : [];

    const reqQuest = location.requiredQuest ?? 0;
    if (unlockedQuest < reqQuest) {
      return {
        canTravel: false,
        reason: `Requer desbloquear a Quest ${reqQuest + 1}`
      };
    }

    const reqChapter = location.requiredChapter ?? 0;
    if (unlockedChapter < reqChapter) {
      return {
        canTravel: false,
        reason: `Requer alcançar o Capítulo ${reqChapter + 1}`
      };
    }

    const reqLevel = location.requiredLevel ?? 1;
    if (level < reqLevel) {
      return {
        canTravel: false,
        reason: `Requer Nível ${reqLevel}`
      };
    }

    if (location.requiredItem && !inventory.includes(location.requiredItem)) {
      return {
        canTravel: false,
        reason: `Requer: ${location.requiredItem}`
      };
    }

    return { canTravel: true, reason: '' };
  }
}
