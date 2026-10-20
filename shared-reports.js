/* One report intake for approved Poetry, Girls' Space and Explore content. */
const herdayReports = (() => {
  const pending = new Map();
  let owner = null;
  function reset() {
    const next=currentUser()?.id || null;
    if (next!==owner) {owner=next;pending.clear();document.querySelector('[data-herday-report-dialog]')?.close();}
  }
  function postId(value) {
    if (!HERDAY_UUID.test(value || '')) throw new Error('Invalid post reference.');
    return value;
  }
  async function submit(post,reason,description='') {
    reset();const author=owner;
    if (!author) throw new Error('Please log in to report content.');
    postId(post);reason=String(reason || '').trim();description=String(description || '').trim();
    if (![...reason].length || [...reason].length>120 || [...description].length>4000) throw new Error('Check the report reason and description.');
    let request=pending.get(post);
    if (request?.sending) throw new Error('Your report is still being sent.');
    if (!request || request.reason!==reason || request.description!==description) {
      request={reason,description,id:crypto.randomUUID(),sending:false};pending.set(post,request);
    }
    request.sending=true;
    try {
      const result=await herdayRpc('herday_submit_content_report',{
        p_submission_id:post,p_reason:reason,p_description:description,p_request_id:request.id
      });
      reset();
      if (owner!==author) throw new Error('Your session changed. Reopen the post to continue.');
      if (!result || !HERDAY_UUID.test(result.id || '') || typeof result.already_reported!=='boolean') throw new Error('Report result could not be confirmed.');
      pending.delete(post);return result;
    } finally {request.sending=false;}
  }
  function open(post) {
    reset();postId(post);
    if (!owner) return nav('login');
    const existing=document.querySelector('[data-herday-report-dialog]');
    if (existing) {if(existing.open)return;existing.remove();}
    const dialog=document.createElement('dialog');dialog.className='herday-report-dialog';dialog.dataset.herdayReportDialog='';
    dialog.setAttribute('aria-labelledby','herdayReportTitle');
    dialog.innerHTML=`<form><h2 id="herdayReportTitle">Report Content</h2>
      <p>Tell us what concerns you about this post.</p>
      <label for="herdayReportReason">Reason</label>
      <select id="herdayReportReason" name="reason" required>
        <option value="">Select a reason</option><option>Copyright / Ownership Concern</option>
        <option>Unauthorized Images</option><option>Community Guidelines Concern</option><option>Other Content Concern</option>
      </select>
      <label for="herdayReportDescription">Details <span>(Optional)</span></label>
      <textarea id="herdayReportDescription" name="description" maxlength="4000" placeholder="Describe your concern..."></textarea>
      <p role="status" aria-live="polite"></p>
      <div class="herday-report-buttons"><button type="button" data-report-cancel>Cancel</button><button type="submit">Submit Report</button></div>
    </form>`;
    const form=dialog.querySelector('form'),button=form.querySelector('[type=submit]'),cancel=form.querySelector('[data-report-cancel]'),status=form.querySelector('[role=status]');
    const draft=pending.get(post);
    if (draft) {form.elements.reason.value=draft.reason;form.elements.description.value=draft.description;}
    cancel.onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>dialog.remove());
    dialog.addEventListener('cancel',event=>{if(button.disabled)event.preventDefault();});
    form.onsubmit=async event=>{
      event.preventDefault();if(!form.reportValidity() || button.disabled)return;
      button.disabled=true;cancel.disabled=true;status.textContent='Submitting report…';
      try {
        const result=await submit(post,form.elements.reason.value,form.elements.description.value);
        if (!dialog.isConnected)return;
        form.querySelectorAll('select,textarea').forEach(field=>field.disabled=true);
        status.textContent=result.already_reported?'You already have an open report for this post.':'Report submitted for review.';
        button.hidden=true;cancel.textContent='Done';
      } catch(error) {if(dialog.isConnected)status.textContent=(error.message || 'Report could not be confirmed.')+' Retry the same report to confirm it without duplicating it.';}
      finally {button.disabled=false;cancel.disabled=false;}
    };
    document.body.append(dialog);dialog.showModal();
  }
  return {reset,submit,open};
})();
