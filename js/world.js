export class WorldMapSystem {
  static getBookLocations(book) {
    if (Array.isArray(book?.locations) && book.locations.length > 0) {
      return book.locations;
    }

    // Fallback automático caso um livro não defina `locations` explicitamente
    return (book?.chapters || []).map((chap, idx) => ({
      id: `loc-${chap.id || idx}`,
      name: chap.title,
      region: book?.title || 'Tamriel',
      description: `Viajar para ${chap.title}.`,
      chapterIndex: idx,
      blockId: chap.startBlock,
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

    const byChapterAndBlock = locations.find(
      (loc) => loc.chapterIndex === state?.chapterIndex && loc.blockId === state?.blockId
    );
    if (byChapterAndBlock) return byChapterAndBlock.id;

    const byChapter = locations.find((loc) => loc.chapterIndex === state?.chapterIndex);
    return byChapter ? byChapter.id : locations[0].id;
  }

  static evaluateTravelAvailability(location, state) {
    const unlockedChapter = state?.unlockedChapter ?? 0;
    const level = state?.progression?.level ?? 1;
    const inventory = Array.isArray(state?.inventory) ? state.inventory : [];

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