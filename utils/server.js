const {data, error} = await supabase
    .from('games')
    .update({ board_state: newMove })
    .eq('id', gameId);

supabase
  .channel('room-1')
  .on('postgres_changes', {event: 'UPDATE', schema: 'public', table: 'games'},
      payload => { updateBoard(payload.new.board_state); })
  .subscribe();
