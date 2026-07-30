const listProfilesFn = useServerFn(listClientProfilesForTraining);
  const profilesQ = useQuery({
    queryKey: ["client_profiles", "training"],
    queryFn: () => listProfilesFn(),
  });