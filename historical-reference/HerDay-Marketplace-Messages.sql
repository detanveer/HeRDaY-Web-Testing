-- DRAFT: reviewed against the supplied live catalogs; not applied to production.
-- Run the entire transaction only with the matching Web/Media Worker release.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('herday-marketplace-messages-v1',0));
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_add_social_comment' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='fffe4961735a598b33eea8e486d9b3e3')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_add_social_comment; export the current definition'; END IF; END $guard$;
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_delete_social_comment' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='84eddf9e5cf09ff4741c3026a0d7e91b')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_delete_social_comment; export the current definition'; END IF; END $guard$;
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_edit_comment_v1' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='3358db4dbb1c880af4e5344fb2d09f13')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_edit_comment_v1; export the current definition'; END IF; END $guard$;
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_get_social_actions' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='836a0aac86b8f18252238eb7f20c8b4e')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_get_social_actions; export the current definition'; END IF; END $guard$;
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_get_social_comments' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='7ac23801c17e0cc4cb611e457d94b417')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_get_social_comments; export the current definition'; END IF; END $guard$;
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_like_social_comment' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='06f8531718a36d11a44acca8b62b2b20')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_like_social_comment; export the current definition'; END IF; END $guard$;
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_public_user_v1' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='ab9450f532ca0410745431f93e482242')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_public_user_v1; export the current definition'; END IF; END $guard$;
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_set_social_action' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='fab92af072d08a6404feea3344988a09')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_set_social_action; export the current definition'; END IF; END $guard$;
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_get_content' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='b3f0c781843da5cd2303668d3a0254d5')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_get_content; export the current definition'; END IF; END $guard$;
DO $guard$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='herday_get_content_v2' AND p.prokind='f' AND md5(pg_get_functiondef(p.oid))='03194a8b4603da333907620c1efdb6b4')<>1 THEN RAISE EXCEPTION 'Backend drift: herday_get_content_v2; export the current definition'; END IF; END $guard$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_about text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_country text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_city text;
ALTER TABLE public.profiles ADD CONSTRAINT herday_public_profile_fields_v1 CHECK (
 length(coalesce(public_about,''))<=2000 AND length(coalesce(public_country,''))<=100
 AND length(coalesce(public_city,''))<=120);

GRANT SELECT(public_about,public_country,public_city), UPDATE(public_about,public_country,public_city) ON public.profiles TO authenticated;

-- Products are content submissions, so the existing comment records/controller are reused.
ALTER TABLE public.content_submissions DROP CONSTRAINT content_submissions_section_key_check;
ALTER TABLE public.content_submissions ADD CONSTRAINT content_submissions_section_key_check
 CHECK(section_key IN ('poetry','explore','girls_space','community','buy_sell'));
ALTER TABLE public.content_submissions ADD CONSTRAINT herday_product_photo_limit_v1
 CHECK(section_key<>'buy_sell' OR jsonb_array_length(r2_object_keys)<=4);
ALTER TABLE public.herday_media_uploads DROP CONSTRAINT herday_media_uploads_section_key_check;
ALTER TABLE public.herday_media_uploads ADD CONSTRAINT herday_media_uploads_section_key_check
 CHECK(section_key IN ('poetry','explore','girls_space','buy_sell'));
ALTER TABLE public.herday_media_uploads DROP CONSTRAINT herday_media_key_format;
ALTER TABLE public.herday_media_uploads ADD CONSTRAINT herday_media_key_format
 CHECK(object_key ~ '^pending/(poetry|explore|girls_space|buy_sell)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');

CREATE TABLE public.herday_product_details_v1 (
 submission_id uuid PRIMARY KEY REFERENCES public.content_submissions(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES public.profiles(id),
 category text NOT NULL CHECK(category IN ('clothing_dresses','bags_purses','shoes_footwear','jewelry','hijabs_scarves','bridal_party','fashion_accessories','beauty_devices')),
 condition text NOT NULL CHECK(condition IN ('new','used')),
 condition_details text NOT NULL DEFAULT '',
 price numeric(16,2) NOT NULL CHECK(price>=0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 negotiable boolean NOT NULL DEFAULT false,
 country text NOT NULL CHECK(length(country) BETWEEN 1 AND 100),
 country_code text NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'),
 city text NOT NULL CHECK(length(city) BETWEEN 1 AND 120),
 chat_enabled boolean NOT NULL,
 whatsapp text CHECK(whatsapp ~ '^[1-9][0-9]{6,14}$'),
 sold boolean NOT NULL DEFAULT false,
 request_payload jsonb NOT NULL,
 UNIQUE(owner_id,request_id),
 CHECK(chat_enabled OR whatsapp IS NOT NULL)
);
CREATE INDEX herday_product_browse_v1 ON public.herday_product_details_v1(category,country_code,submission_id) WHERE NOT sold;
ALTER TABLE public.herday_product_details_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.herday_product_details_v1 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.herday_social_visible_v2(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.content_submissions s JOIN public.profiles a ON a.id=s.author_id
 WHERE s.id=p_id AND s.status='approved' AND
 (s.section_key IN ('poetry','explore','girls_space','community') OR
 (s.section_key='buy_sell' AND NOT a.is_blocked AND EXISTS(SELECT 1 FROM public.herday_product_details_v1 d WHERE d.submission_id=s.id AND NOT d.sold))));
$$;
REVOKE ALL ON FUNCTION public.herday_social_visible_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.herday_social_visible_v2(uuid) TO anon,authenticated;

CREATE FUNCTION public.herday_product_submit_v1(p_request_id uuid,p_product jsonb,p_keys jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.herday_product_details_v1%ROWTYPE; sid uuid:=gen_random_uuid(); payload jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.is_active_user() IS DISTINCT FROM true THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_product IS NULL OR jsonb_typeof(p_product)<>'object' OR p_keys IS NULL OR jsonb_typeof(p_keys)<>'array'
 OR jsonb_array_length(p_keys)>4 OR length(btrim(coalesce(p_product->>'title',''))) NOT BETWEEN 1 AND 180
 OR length(btrim(coalesce(p_product->>'description',''))) NOT BETWEEN 1 AND 20000
 OR length(coalesce(p_product->>'condition_details',''))>2000
 OR coalesce(p_product->>'price','')!~'^[0-9]{1,14}([.][0-9]{1,2})?$'
 OR nullif(btrim(p_product->>'city'),'') IS NULL OR nullif(btrim(p_product->>'country'),'') IS NULL
 THEN RAISE EXCEPTION 'Check product fields and up to four photos' USING ERRCODE='22023'; END IF;
 payload:=jsonb_build_object('product',p_product,'keys',p_keys);
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 SELECT * INTO old FROM public.herday_product_details_v1 WHERE owner_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN
  IF old.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Request ID already used' USING ERRCODE='22023'; END IF;
  RETURN (SELECT jsonb_build_object('id',s.id,'status',s.status) FROM public.content_submissions s WHERE s.id=old.submission_id);
 END IF;
 -- Existing media trigger validates and locks registered uploads/ownership.
 INSERT INTO public.content_submissions(id,author_id,section_key,title,body,r2_object_keys,status)
 VALUES(sid,auth.uid(),'buy_sell',btrim(p_product->>'title'),btrim(p_product->>'description'),p_keys,'pending');
 INSERT INTO public.herday_product_details_v1(submission_id,request_id,owner_id,category,condition,condition_details,price,currency,negotiable,country,country_code,city,chat_enabled,whatsapp,request_payload)
 VALUES(sid,p_request_id,auth.uid(),p_product->>'category',p_product->>'condition',coalesce(p_product->>'condition_details',''),
 (p_product->>'price')::numeric,p_product->>'currency',(p_product->>'negotiable')::boolean,btrim(p_product->>'country'),p_product->>'country_code',btrim(p_product->>'city'),
 (p_product->>'chat_enabled')::boolean,nullif(p_product->>'whatsapp',''),payload);
 RETURN jsonb_build_object('id',sid,'status','pending');
END $$;

CREATE FUNCTION public.herday_product_feed_v1(p_category text DEFAULT NULL,p_country text DEFAULT NULL,p_query text DEFAULT '',p_seed uuid DEFAULT NULL,p_offset integer DEFAULT 0,p_view text DEFAULT 'public',p_owner uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('public','mine','queue') OR p_offset IS NULL OR p_offset<0 
 OR p_query IS NULL OR length(p_query)>200 OR (p_view='public' AND p_seed IS NULL) THEN RAISE EXCEPTION 'Invalid product request' USING ERRCODE='22023'; END IF;
 IF p_view<>'public' AND (auth.uid() IS NULL OR public.is_active_user() IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 IF p_view='queue' AND public.is_admin() IS DISTINCT FROM true THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x.order_key,x.id),'[]'::jsonb) INTO rows FROM (
 SELECT s.id,s.author_id,s.section_key,s.title,s.body,s.r2_object_keys,s.status,s.created_at,s.updated_at,
 d.category,d.condition,d.condition_details,d.price,d.currency,d.negotiable,d.country,d.country_code,d.city,d.sold,d.chat_enabled,
 CASE WHEN p_view='public' THEN md5(s.id::text||p_seed::text) ELSE s.created_at::text END AS order_key,
 EXISTS(SELECT 1 FROM public.herday_poetry_saves b WHERE b.submission_id=s.id AND b.user_id=auth.uid()) AS saved
 FROM public.content_submissions s JOIN public.herday_product_details_v1 d ON d.submission_id=s.id
 JOIN public.profiles a ON a.id=s.author_id
 WHERE s.section_key='buy_sell' AND (p_category IS NULL OR d.category=p_category)
 AND (p_country IS NULL OR d.country_code=p_country) AND (p_owner IS NULL OR s.author_id=p_owner)
 AND (p_query='' OR strpos(lower(s.title||' '||s.body),lower(p_query))>0)
 AND ((p_view='public' AND public.herday_social_visible_v2(s.id)) OR (p_view='mine' AND s.author_id=auth.uid()) OR (p_view='queue' AND s.status='pending'))
 ORDER BY order_key,s.id OFFSET p_offset LIMIT 25) x;
 RETURN jsonb_build_object('entries',rows,'more',jsonb_array_length(rows)>24);
END $$;

CREATE FUNCTION public.herday_product_v1(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN (SELECT to_jsonb(s)||to_jsonb(d)-'request_payload'-'request_id'-'owner_id' FROM public.content_submissions s
 JOIN public.herday_product_details_v1 d ON d.submission_id=s.id
 WHERE s.id=p_id AND s.section_key='buy_sell' AND (public.herday_social_visible_v2(s.id) OR
 (auth.uid() IS NOT NULL AND public.is_active_user() AND (s.author_id=auth.uid() OR public.is_admin()))));
END $$;

CREATE FUNCTION public.herday_product_status_v1(p_id uuid,p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.content_submissions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_active_user() IS DISTINCT FROM true THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.content_submissions WHERE id=p_id AND section_key='buy_sell' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable' USING ERRCODE='22023'; END IF;
 IF p_action='sold' AND s.author_id=auth.uid() THEN UPDATE public.herday_product_details_v1 SET sold=true WHERE submission_id=s.id;
 ELSIF p_action IN ('approve','reject') AND public.is_admin() IS TRUE AND s.status='pending' THEN
 PERFORM set_config('herday.product_approval',s.id::text,true);
 UPDATE public.content_submissions SET status=CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,moderated_at=now(),moderated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=s.id;
 PERFORM set_config('herday.product_approval','',true);
 ELSE RAISE EXCEPTION 'Action unavailable' USING ERRCODE='42501'; END IF;
 RETURN public.herday_product_v1(s.id);
END $$;

-- Keep product approval isolated from generic staff-own content editors.
CREATE FUNCTION public.herday_product_lifecycle_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.section_key<>'buy_sell' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'pending' THEN RAISE EXCEPTION 'Submit products for Admin approval' USING ERRCODE='42501'; END IF;
 ELSIF current_setting('herday.product_approval',true) IS DISTINCT FROM NEW.id::text OR public.is_admin() IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Use product approval' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.herday_product_lifecycle_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER herday_product_lifecycle_guard_v1 BEFORE INSERT OR UPDATE ON public.content_submissions
 FOR EACH ROW EXECUTE FUNCTION public.herday_product_lifecycle_guard_v1();

-- Exact product-image authorization; Worker streams only the returned registered key.
CREATE FUNCTION public.herday_product_image_v1(p_key text,p_private boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN (SELECT jsonb_build_object('key',m.object_key,'owner',m.owner_id,'mime',m.mime_type,'size',m.size_bytes,'section','buy_sell')
 FROM public.herday_media_uploads m JOIN public.content_submissions s ON s.id=m.submission_id
 WHERE m.object_key=p_key AND m.section_key='buy_sell' AND s.section_key='buy_sell' AND m.owner_id=s.author_id
 AND s.r2_object_keys@>jsonb_build_array(m.object_key)
 AND ((NOT p_private AND public.herday_social_visible_v2(s.id)) OR
 (p_private AND auth.uid() IS NOT NULL AND public.is_active_user() AND (s.author_id=auth.uid() OR public.is_admin()))));
END $$;
CREATE FUNCTION public.herday_product_upload_lookup_v1(p_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.is_active_user() AND EXISTS(SELECT 1 FROM public.herday_media_uploads WHERE object_key=p_key AND owner_id=auth.uid() AND section_key='buy_sell' AND submission_id IS NULL);
$$;

-- One pair of participants has one conversation, independent of entry point.
CREATE TABLE public.herday_conversations_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 participant_a uuid NOT NULL REFERENCES public.profiles(id),
 participant_b uuid NOT NULL REFERENCES public.profiles(id),
 read_a bigint NOT NULL DEFAULT 0,read_b bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(participant_a<participant_b),UNIQUE(participant_a,participant_b)
);
CREATE TABLE public.herday_messages_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 conversation_id uuid NOT NULL REFERENCES public.herday_conversations_v1(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.profiles(id),
 request_id uuid NOT NULL,
 body text NOT NULL CHECK(length(body)<=2000),
 attachment_keys jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(sender_id,request_id),
 CHECK(jsonb_typeof(attachment_keys)='array' AND jsonb_array_length(attachment_keys)<=5),
 CHECK(length(btrim(body))>0 OR jsonb_array_length(attachment_keys)>0)
);
CREATE INDEX herday_messages_conversation_seq_v1 ON public.herday_messages_v1(conversation_id,seq);
CREATE TABLE public.herday_message_media_v1 (
 object_key text PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES public.profiles(id),
 conversation_id uuid NOT NULL REFERENCES public.herday_conversations_v1(id) ON DELETE CASCADE,
 message_id uuid REFERENCES public.herday_messages_v1(id) ON DELETE CASCADE,
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.herday_message_presence_v1 (
 owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 session_id uuid NOT NULL,expires_at timestamptz NOT NULL,
 PRIMARY KEY(owner_id,session_id)
);
ALTER TABLE public.herday_conversations_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herday_messages_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herday_message_media_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herday_message_presence_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.herday_conversations_v1,public.herday_messages_v1,public.herday_message_media_v1,public.herday_message_presence_v1 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.herday_conversation_allowed_v1(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.is_active_user() AND EXISTS(
 SELECT 1 FROM public.herday_conversations_v1 c JOIN public.profiles a ON a.id=c.participant_a JOIN public.profiles b ON b.id=c.participant_b
 WHERE c.id=p_id AND auth.uid() IN (c.participant_a,c.participant_b) AND NOT a.is_blocked AND NOT b.is_blocked);
$$;
CREATE FUNCTION public.herday_message_identity_v1(p_target uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',id,'name',CASE WHEN role::text='admin' THEN 'Admin' ELSE btrim(first_name||' '||last_name) END,
 'avatar_path',CASE WHEN avatar_path LIKE id::text||'/%' THEN avatar_path ELSE NULL END,
 'online',EXISTS(SELECT 1 FROM public.herday_message_presence_v1 p WHERE p.owner_id=id AND p.expires_at>clock_timestamp()))
 FROM public.profiles WHERE id=p_target AND NOT is_blocked;
$$;
-- Identity helper is private: only participant-authorized RPCs call it.
CREATE FUNCTION public.herday_conversation_open_v1(p_peer uuid,p_product uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; a uuid;b uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_active_user() IS DISTINCT FROM true OR p_peer IS NULL OR p_peer=auth.uid()
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_peer AND NOT is_blocked) THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
 IF p_product IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.herday_product_details_v1 d JOIN public.content_submissions s ON s.id=d.submission_id
 WHERE s.id=p_product AND s.author_id=p_peer AND d.chat_enabled AND public.herday_social_visible_v2(s.id))
 THEN RAISE EXCEPTION 'Seller chat unavailable' USING ERRCODE='42501'; END IF;
 a:=least(auth.uid(),p_peer);b:=greatest(auth.uid(),p_peer);
 INSERT INTO public.herday_conversations_v1(participant_a,participant_b) VALUES(a,b) ON CONFLICT(participant_a,participant_b) DO NOTHING;
 SELECT id INTO cid FROM public.herday_conversations_v1 WHERE participant_a=a AND participant_b=b;
 RETURN cid;
END $$;
CREATE FUNCTION public.herday_messages_inbox_v1(p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_active_user() IS DISTINCT FROM true THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 IF (p_before IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid cursor' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.updated_at DESC,q.id DESC),'[]') FROM (
 SELECT c.id,public.herday_message_identity_v1(CASE WHEN c.participant_a=auth.uid() THEN c.participant_b ELSE c.participant_a END) AS peer,
 m.body AS preview,m.attachment_keys,m.created_at AS updated_at,
 (SELECT count(*) FROM public.herday_messages_v1 u WHERE u.conversation_id=c.id AND u.sender_id<>auth.uid() AND u.seq>CASE WHEN c.participant_a=auth.uid() THEN c.read_a ELSE c.read_b END) AS unread
 FROM public.herday_conversations_v1 c JOIN LATERAL(SELECT body,attachment_keys,created_at FROM public.herday_messages_v1 WHERE conversation_id=c.id ORDER BY seq DESC LIMIT 1) m ON true
 WHERE public.herday_conversation_allowed_v1(c.id) AND (p_before IS NULL OR (m.created_at,c.id)<(p_before,p_before_id))
 ORDER BY m.created_at DESC,c.id DESC LIMIT 31) q);
END $$;
CREATE FUNCTION public.herday_messages_read_v1(p_conversation uuid,p_before bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE peer uuid; rows jsonb;
BEGIN
 IF public.herday_conversation_allowed_v1(p_conversation) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
 SELECT CASE WHEN participant_a=auth.uid() THEN participant_b ELSE participant_a END INTO peer FROM public.herday_conversations_v1 WHERE id=p_conversation;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.seq DESC),'[]') INTO rows FROM (SELECT id,seq,sender_id,body,attachment_keys,created_at
 FROM public.herday_messages_v1 WHERE conversation_id=p_conversation AND (p_before IS NULL OR seq<p_before) ORDER BY seq DESC LIMIT 31) q;
 RETURN jsonb_build_object('peer',public.herday_message_identity_v1(peer),'entries',rows);
END $$;
CREATE FUNCTION public.herday_messages_ack_v1(p_conversation uuid,p_seq bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.herday_conversation_allowed_v1(p_conversation) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.herday_messages_v1 WHERE conversation_id=p_conversation AND seq=p_seq) THEN RETURN; END IF;
 UPDATE public.herday_conversations_v1 SET read_a=CASE WHEN participant_a=auth.uid() THEN greatest(read_a,p_seq) ELSE read_a END,
 read_b=CASE WHEN participant_b=auth.uid() THEN greatest(read_b,p_seq) ELSE read_b END WHERE id=p_conversation;
END $$;
CREATE FUNCTION public.herday_message_send_v1(p_conversation uuid,p_request uuid,p_body text,p_keys jsonb DEFAULT '[]') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.herday_messages_v1%ROWTYPE; mid uuid:=gen_random_uuid(); n integer;
BEGIN
 IF public.herday_conversation_allowed_v1(p_conversation) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_body IS NULL OR length(p_body)>2000 OR p_keys IS NULL OR jsonb_typeof(p_keys)<>'array' OR jsonb_array_length(p_keys)>5
 OR (length(btrim(p_body))=0 AND jsonb_array_length(p_keys)=0) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_keys) k WHERE jsonb_typeof(k)<>'string')
 OR (SELECT count(DISTINCT k) FROM jsonb_array_elements_text(p_keys) k)<>jsonb_array_length(p_keys)
 THEN RAISE EXCEPTION 'Invalid message' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 SELECT * INTO old FROM public.herday_messages_v1 WHERE sender_id=auth.uid() AND request_id=p_request;
 IF FOUND THEN
  IF old.conversation_id IS DISTINCT FROM p_conversation OR old.body IS DISTINCT FROM p_body OR old.attachment_keys IS DISTINCT FROM p_keys THEN RAISE EXCEPTION 'Request ID already used' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('id',old.id,'seq',old.seq);
 END IF;
 -- Serialize messages in one conversation, keeping sequence/read watermarks commit-safe.
 PERFORM 1 FROM public.herday_conversations_v1 WHERE id=p_conversation FOR UPDATE;
 PERFORM 1 FROM public.herday_message_media_v1 WHERE object_key IN (SELECT jsonb_array_elements_text(p_keys)) ORDER BY object_key FOR UPDATE;
 SELECT count(*) INTO n FROM public.herday_message_media_v1 WHERE object_key IN (SELECT jsonb_array_elements_text(p_keys)) AND owner_id=auth.uid() AND conversation_id=p_conversation AND message_id IS NULL;
 IF n<>jsonb_array_length(p_keys) THEN RAISE EXCEPTION 'Attachment unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO public.herday_messages_v1(id,conversation_id,sender_id,request_id,body,attachment_keys) VALUES(mid,p_conversation,auth.uid(),p_request,p_body,p_keys) RETURNING * INTO old;
 UPDATE public.herday_message_media_v1 SET message_id=mid WHERE object_key IN (SELECT jsonb_array_elements_text(p_keys));
 RETURN jsonb_build_object('id',mid,'seq',old.seq);
END $$;
CREATE FUNCTION public.herday_message_presence_v1(p_online boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
BEGIN
 IF auth.uid() IS NULL OR sid IS NULL OR public.is_active_user() IS DISTINCT FROM true THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 IF p_online IS TRUE THEN
 INSERT INTO public.herday_message_presence_v1(owner_id,session_id,expires_at) VALUES(auth.uid(),sid,least(clock_timestamp()+interval '40 seconds',to_timestamp((auth.jwt()->>'exp')::double precision)))
 ON CONFLICT(owner_id,session_id) DO UPDATE SET expires_at=excluded.expires_at;
 ELSE DELETE FROM public.herday_message_presence_v1 WHERE owner_id=auth.uid() AND session_id=sid; END IF;
END $$;
CREATE FUNCTION public.herday_message_media_register_v1(p_owner uuid,p_conversation uuid,p_key text,p_mime text,p_size bigint,p_fingerprint text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.herday_message_media_v1%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.herday_conversations_v1 c JOIN public.profiles a ON a.id=c.participant_a JOIN public.profiles b ON b.id=c.participant_b
 WHERE c.id=p_conversation AND p_owner IN (c.participant_a,c.participant_b) AND NOT a.is_blocked AND NOT b.is_blocked)
 OR p_key!~('^messages/'||p_conversation::text||'/'||p_owner::text||'/[0-9a-f-]{36}[.](jpg|png|webp)$')
 THEN RAISE EXCEPTION 'Attachment unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO public.herday_message_media_v1(object_key,owner_id,conversation_id,mime_type,size_bytes,fingerprint)
 VALUES(p_key,p_owner,p_conversation,p_mime,p_size,p_fingerprint) ON CONFLICT(object_key) DO NOTHING;
 SELECT * INTO old FROM public.herday_message_media_v1 WHERE object_key=p_key;
 RETURN old.owner_id=p_owner AND old.conversation_id=p_conversation AND old.mime_type=p_mime AND old.size_bytes=p_size AND old.fingerprint=p_fingerprint AND old.message_id IS NULL;
END $$;
CREATE FUNCTION public.herday_message_media_read_v1(p_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN (SELECT jsonb_build_object('key',object_key,'owner',owner_id,'mime',mime_type,'size',size_bytes,'section','messages')
 FROM public.herday_message_media_v1 WHERE object_key=p_key AND public.herday_conversation_allowed_v1(conversation_id)
 AND (message_id IS NOT NULL OR owner_id=auth.uid()));
END $$;

-- Extend the installed shared implementation; preserve its current signature.
CREATE OR REPLACE FUNCTION public.herday_add_social_comment(p_submission_id uuid, p_body text, p_request_id uuid, p_parent_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid; v_old public.herday_poetry_comments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE='42501';
  END IF;
  IF p_submission_id IS NULL OR p_request_id IS NULL OR p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Enter 1 to 2000 characters' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.content_submissions WHERE id=p_submission_id AND status='approved'
    AND section_key IN ('poetry','explore','girls_space','community','buy_sell') AND (section_key<>'buy_sell' OR public.herday_social_visible_v2(id)) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Published post unavailable' USING ERRCODE='42501'; END IF;
  IF p_parent_id IS NOT NULL THEN
    PERFORM 1 FROM public.herday_poetry_comments WHERE id=p_parent_id AND submission_id=p_submission_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reply comment unavailable' USING ERRCODE='22023'; END IF;
  END IF;
  INSERT INTO public.herday_poetry_comments(submission_id,author_id,request_id,body,parent_comment_id)
    VALUES(p_submission_id,auth.uid(),p_request_id,btrim(p_body),p_parent_id)
    ON CONFLICT(author_id,request_id) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT * INTO v_old FROM public.herday_poetry_comments WHERE author_id=auth.uid() AND request_id=p_request_id;
  IF NOT FOUND OR v_old.submission_id IS DISTINCT FROM p_submission_id
    OR v_old.body IS DISTINCT FROM btrim(p_body) OR v_old.parent_comment_id IS DISTINCT FROM p_parent_id THEN
    RAISE EXCEPTION 'Request ID already used' USING ERRCODE='22023';
  END IF;
  RETURN v_old.id;
END;
$function$
;

-- Extend the installed shared implementation; preserve its current signature.
CREATE OR REPLACE FUNCTION public.herday_delete_social_comment(p_comment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_author uuid; v_submission uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  IF p_comment_id IS NULL THEN RAISE EXCEPTION 'Invalid comment' USING ERRCODE='22023'; END IF;
  SELECT submission_id INTO v_submission FROM public.herday_poetry_comments WHERE id=p_comment_id;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM 1 FROM public.content_submissions WHERE id=v_submission
    AND section_key IN ('poetry','explore','girls_space','community','buy_sell') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comment unavailable' USING ERRCODE='42501'; END IF;
  SELECT author_id INTO v_author FROM public.herday_poetry_comments WHERE id=p_comment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_author IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only your own comments may be deleted' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.herday_poetry_comments WHERE id=p_comment_id;
END;
$function$
;

-- Extend the installed shared implementation; preserve its current signature.
CREATE OR REPLACE FUNCTION public.herday_edit_comment_v1(p_comment_id uuid, p_body text, p_expected_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_comment public.herday_poetry_comments%ROWTYPE;v_body text:=btrim(p_body);v_owner uuid:=auth.uid();
BEGIN
 IF v_owner IS NULL OR NOT public.is_active_user() THEN
  RAISE EXCEPTION 'Login required' USING ERRCODE='42501';
 END IF;
 IF p_comment_id IS NULL OR v_body IS NULL OR length(v_body) NOT BETWEEN 1 AND 2000 OR p_expected_body IS NULL THEN
  RAISE EXCEPTION 'Enter a comment of 1 to 2000 characters' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_comment FROM public.herday_poetry_comments WHERE id=p_comment_id FOR UPDATE;
 IF NOT FOUND OR v_comment.author_id IS DISTINCT FROM v_owner THEN
  RAISE EXCEPTION 'You can edit only your own comment' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.content_submissions WHERE id=v_comment.submission_id AND status='approved' AND section_key IN ('poetry','explore','girls_space','community','buy_sell') AND (section_key<>'buy_sell' OR public.herday_social_visible_v2(id))) THEN
  RAISE EXCEPTION 'Published post unavailable' USING ERRCODE='42501';
 END IF;
 -- Replaying an acknowledged/uncertain save is safe and does not duplicate comments.
 IF v_comment.body=v_body THEN RETURN jsonb_build_object('comment_id',p_comment_id,'body',v_body); END IF;
 IF v_comment.body IS DISTINCT FROM p_expected_body THEN
  RAISE EXCEPTION 'This comment changed. Close the editor, refresh comments and try again.' USING ERRCODE='40001';
 END IF;
 UPDATE public.herday_poetry_comments SET body=v_body WHERE id=p_comment_id AND author_id=v_owner;
 RETURN jsonb_build_object('comment_id',p_comment_id,'body',v_body);
END $function$
;

-- Extend the installed shared implementation; preserve its current signature.
CREATE OR REPLACE FUNCTION public.herday_get_social_actions(p_submission_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_submission_ids IS NULL OR cardinality(p_submission_ids)>100 THEN
    RAISE EXCEPTION 'Invalid posts request' USING ERRCODE='22023';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,
      'likes',(SELECT count(*) FROM public.herday_poetry_likes l WHERE l.submission_id=s.id),
      'liked',public.is_active_user() AND EXISTS(SELECT 1 FROM public.herday_poetry_likes l WHERE l.submission_id=s.id AND l.user_id=auth.uid()),
      'saved',public.is_active_user() AND EXISTS(SELECT 1 FROM public.herday_poetry_saves b WHERE b.submission_id=s.id AND b.user_id=auth.uid()),
      'comment_count',(SELECT count(*) FROM public.herday_poetry_comments c WHERE c.submission_id=s.id)
    )),'[]'::jsonb)
    FROM public.content_submissions s
    WHERE s.id=ANY(p_submission_ids) AND s.status='approved'
      AND s.section_key IN ('poetry','explore','girls_space','community','buy_sell') AND (s.section_key<>'buy_sell' OR public.herday_social_visible_v2(s.id))
  );
END;
$function$
;

-- Extend the installed shared implementation; preserve its current signature.
CREATE OR REPLACE FUNCTION public.herday_get_social_comments(p_submission_id uuid, p_after_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_after_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_submission_id IS NULL OR ((p_after_created_at IS NULL)<>(p_after_id IS NULL)) THEN
    RAISE EXCEPTION 'Invalid comment read parameters' USING ERRCODE='22023';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at,r.id),'[]'::jsonb)
    FROM (
      SELECT c.id,c.submission_id,c.author_id,c.body,c.created_at,c.parent_comment_id,
        (SELECT count(*) FROM public.herday_comment_likes l WHERE l.comment_id=c.id) AS likes,
        public.is_active_user() AND EXISTS(SELECT 1 FROM public.herday_comment_likes l WHERE l.comment_id=c.id AND l.user_id=auth.uid()) AS liked,
        (SELECT count(*) FROM public.herday_poetry_comments t WHERE t.submission_id=p_submission_id) AS total_count
      FROM public.herday_poetry_comments c
      JOIN public.content_submissions s ON s.id=c.submission_id
      WHERE s.id=p_submission_id AND s.status='approved'
        AND s.section_key IN ('poetry','explore','girls_space','community','buy_sell') AND (s.section_key<>'buy_sell' OR public.herday_social_visible_v2(s.id))
        AND (p_after_created_at IS NULL OR (c.created_at,c.id)>(p_after_created_at,p_after_id))
      ORDER BY c.created_at,c.id LIMIT 30
    ) r
  );
END;
$function$
;

-- Extend the installed shared implementation; preserve its current signature.
CREATE OR REPLACE FUNCTION public.herday_like_social_comment(p_comment_id uuid, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_post uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE='42501';
  END IF;
  IF p_comment_id IS NULL OR p_enabled IS NULL THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023'; END IF;
  SELECT submission_id INTO v_post FROM public.herday_poetry_comments WHERE id=p_comment_id;
  PERFORM 1 FROM public.content_submissions WHERE id=v_post AND status='approved'
    AND section_key IN ('poetry','explore','girls_space','community','buy_sell') AND (section_key<>'buy_sell' OR public.herday_social_visible_v2(id)) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comment unavailable' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.herday_poetry_comments WHERE id=p_comment_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comment unavailable' USING ERRCODE='42501'; END IF;
  IF p_enabled THEN
    INSERT INTO public.herday_comment_likes(comment_id,user_id) VALUES(p_comment_id,auth.uid()) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.herday_comment_likes WHERE comment_id=p_comment_id AND user_id=auth.uid(); END IF;
END;
$function$
;

-- Extend the installed shared implementation; preserve its current signature.
CREATE OR REPLACE FUNCTION public.herday_set_social_action(p_submission_id uuid, p_action text, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE='42501';
  END IF;
  IF p_submission_id IS NULL OR p_action IS NULL OR p_action NOT IN ('like','save') OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.content_submissions WHERE id=p_submission_id AND status='approved'
    AND section_key IN ('poetry','explore','girls_space','community','buy_sell') AND (section_key<>'buy_sell' OR public.herday_social_visible_v2(id)) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Published post unavailable' USING ERRCODE='42501'; END IF;
  IF p_action='like' THEN
    IF p_enabled THEN
      INSERT INTO public.herday_poetry_likes(submission_id,user_id) VALUES(p_submission_id,auth.uid()) ON CONFLICT DO NOTHING;
    ELSE DELETE FROM public.herday_poetry_likes WHERE submission_id=p_submission_id AND user_id=auth.uid(); END IF;
  ELSE
    IF p_enabled THEN
      INSERT INTO public.herday_poetry_saves(submission_id,user_id) VALUES(p_submission_id,auth.uid()) ON CONFLICT DO NOTHING;
    ELSE DELETE FROM public.herday_poetry_saves WHERE submission_id=p_submission_id AND user_id=auth.uid(); END IF;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.herday_public_user_v1(p_target uuid, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE person jsonb;posts jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.is_active_user() IS DISTINCT FROM true THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 IF (p_before_at IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid cursor'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_target AND is_blocked=false) THEN RETURN jsonb_build_object('available',false); END IF;
 -- Respect the installed public identity boundary (including admin display names).
 SELECT jsonb_build_object('id',p_target,'name',coalesce(nullif(x.value->>'public_name',''),'HerDay User'),'avatar_path',x.value->>'avatar_path') INTO person
 FROM jsonb_array_elements(public.herday_get_author_identities(p_author_ids=>ARRAY[p_target])) AS x(value) WHERE x.value->>'id'=p_target::text LIMIT 1;
 IF person IS NULL AND (EXISTS(SELECT 1 FROM public.herday_product_details_v1 d WHERE d.owner_id=p_target AND public.herday_social_visible_v2(d.submission_id))
 OR EXISTS(SELECT 1 FROM public.herday_conversations_v1 c WHERE p_target IN(c.participant_a,c.participant_b) AND public.herday_conversation_allowed_v1(c.id))) THEN
 SELECT jsonb_build_object('id',p.id,'name',CASE WHEN p.role::text='admin' THEN 'Admin' ELSE btrim(p.first_name||' '||p.last_name) END,'avatar_path',CASE WHEN p.avatar_path LIKE p.id::text||'/%' THEN p.avatar_path ELSE NULL END) INTO person FROM public.profiles p WHERE p.id=p_target AND NOT p.is_blocked;
 END IF;
 IF person IS NULL THEN RETURN jsonb_build_object('available',false); END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb) INTO posts FROM (
 SELECT s.id,s.author_id,s.section_key,
 CASE WHEN s.section_key='explore' THEN e.category_key WHEN s.section_key='girls_space' THEN g.topic_key ELSE NULL END AS detail_key,
 s.title,s.body,s.created_at,s.r2_object_keys,p.category_id AS poetry_category_id
 FROM public.content_submissions s
 LEFT JOIN public.poetry_submission_details p ON p.submission_id=s.id
 LEFT JOIN public.explore_submission_details e ON e.submission_id=s.id
 LEFT JOIN public.girls_space_submission_details g ON g.submission_id=s.id
 WHERE s.author_id=p_target AND s.status='approved' AND s.section_key IN ('poetry','explore','girls_space','community')
 AND (p_before_at IS NULL OR (s.created_at,s.id)<(p_before_at,p_before_id)) ORDER BY s.created_at DESC,s.id DESC LIMIT 31) q;
 SELECT person||jsonb_build_object('about',coalesce(p.public_about,''),'country',coalesce(p.public_country,''),'city',coalesce(p.public_city,'')) INTO person FROM public.profiles p WHERE p.id=p_target;
 RETURN jsonb_build_object('available',true,'person',person,'entries',posts);
END $function$
;

CREATE FUNCTION public.herday_market_identities_v1(p_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_ids IS NULL OR cardinality(p_ids)>100 THEN RAISE EXCEPTION 'Invalid authors' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'public_name',CASE WHEN p.role::text='admin' THEN 'Admin' ELSE btrim(p.first_name||' '||p.last_name) END,
 'avatar_path',CASE WHEN p.avatar_path LIKE p.id::text||'/%' THEN p.avatar_path ELSE NULL END)),'[]')
 FROM public.profiles p WHERE p.id=ANY(p_ids) AND NOT p.is_blocked AND (
 EXISTS(SELECT 1 FROM public.content_submissions s WHERE s.author_id=p.id AND s.section_key='buy_sell' AND public.herday_social_visible_v2(s.id)) OR
 EXISTS(SELECT 1 FROM public.herday_poetry_comments c JOIN public.content_submissions s ON s.id=c.submission_id WHERE c.author_id=p.id AND s.section_key='buy_sell' AND public.herday_social_visible_v2(s.id))));
END $$;

DO $grants$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY(ARRAY['herday_social_visible_v2','herday_product_submit_v1','herday_product_feed_v1','herday_product_v1','herday_product_status_v1','herday_product_image_v1','herday_product_upload_lookup_v1','herday_conversation_allowed_v1','herday_message_identity_v1','herday_conversation_open_v1','herday_messages_inbox_v1','herday_messages_read_v1','herday_messages_ack_v1','herday_message_send_v1','herday_message_presence_v1','herday_message_media_register_v1','herday_message_media_read_v1','herday_market_identities_v1']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 IF f.proname IN ('herday_message_media_register_v1','herday_product_image_v1') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END IF;
 IF f.proname NOT IN ('herday_message_media_register_v1') AND f.proname NOT IN ('herday_message_identity_v1') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END IF;
 IF f.proname IN ('herday_social_visible_v2','herday_product_feed_v1','herday_product_v1','herday_product_image_v1','herday_market_identities_v1') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.signature); END IF;
 END LOOP;
END $grants$;

-- Existing section feeds keep their installed contract and exclude product rows.
CREATE OR REPLACE FUNCTION public.herday_get_content(p_view text, p_section_key text DEFAULT NULL::text, p_limit integer DEFAULT 30)
 RETURNS TABLE(id uuid, author_id uuid, section_key text, title text, body text, r2_object_keys jsonb, status text, created_at timestamp with time zone, updated_at timestamp with time zone, detail_key text, poetry_category_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('published','mine','queue') OR (p_section_key IS NOT NULL AND p_section_key NOT IN ('poetry','explore','girls_space','community')) OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid read parameters' USING ERRCODE='22023'; END IF;
 IF p_view<>'published' AND (auth.uid() IS NULL OR NOT public.is_active_user()) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF p_view='queue' AND ((p_section_key IS NULL AND NOT public.is_admin()) OR (p_section_key IS NOT NULL AND NOT public.is_admin() AND NOT public.has_moderator_section_permission(p_section_key,'review'))) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT s.id,s.author_id,s.section_key,s.title,s.body,s.r2_object_keys,s.status,s.created_at,s.updated_at,
 CASE WHEN s.section_key='explore' THEN e.category_key WHEN s.section_key='girls_space' THEN g.topic_key WHEN s.section_key='community' THEN cm.category_key ELSE NULL END,p.category_id
 FROM public.content_submissions s LEFT JOIN public.poetry_submission_details p ON p.submission_id=s.id
 LEFT JOIN public.explore_submission_details e ON e.submission_id=s.id
 LEFT JOIN public.girls_space_submission_details g ON g.submission_id=s.id
 LEFT JOIN public.herday_community_details_v1 cm ON cm.submission_id=s.id
 WHERE s.section_key IN ('poetry','explore','girls_space','community') AND (p_section_key IS NULL OR s.section_key=p_section_key) AND ((p_view='published' AND s.status='approved') OR (p_view='mine' AND s.author_id=auth.uid()) OR (p_view='queue' AND s.status='pending' AND (public.is_admin() OR public.has_moderator_section_permission(s.section_key,'review'))))
 ORDER BY s.created_at DESC,s.id DESC LIMIT p_limit;
END $function$
;
CREATE OR REPLACE FUNCTION public.herday_get_content_v2(p_view text, p_section_key text DEFAULT NULL::text, p_limit integer DEFAULT 30, p_before_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_submission_id uuid DEFAULT NULL::uuid, p_query text DEFAULT ''::text, p_category_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('published','mine','queue') OR (p_section_key IS NOT NULL AND p_section_key NOT IN ('poetry','explore','girls_space','community')) OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR ((p_before_created_at IS NULL)<>(p_before_id IS NULL)) OR length(coalesce(p_query,''))>200 THEN RAISE EXCEPTION 'Invalid read parameters' USING ERRCODE='22023'; END IF;
 IF p_view<>'published' AND (auth.uid() IS NULL OR NOT public.is_active_user()) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF p_view='queue' AND ((p_section_key IS NULL AND NOT public.is_admin()) OR (p_section_key IS NOT NULL AND NOT public.has_moderator_section_permission(p_section_key,'review'))) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(rows) ORDER BY rows.created_at DESC,rows.id DESC),'[]'::jsonb) INTO result FROM (
  SELECT s.id,s.author_id,s.section_key,s.title,s.body,s.r2_object_keys,s.status,s.created_at,s.updated_at,p.category_id AS poetry_category_id,
   coalesce(c.name,p.category_name_snapshot) AS category_name,
   CASE WHEN s.section_key='explore' THEN e.category_key WHEN s.section_key='girls_space' THEN g.topic_key WHEN s.section_key='community' THEN cm.category_key ELSE NULL END AS detail_key,
   CASE WHEN p_view='mine' AND s.status='rejected' THEN (SELECT d.reason FROM public.content_moderation_decisions d WHERE d.submission_id=s.id AND d.to_status='rejected' ORDER BY d.created_at DESC,d.id DESC LIMIT 1) END AS rejection_reason
  FROM public.content_submissions s
  LEFT JOIN public.poetry_submission_details p ON p.submission_id=s.id
  LEFT JOIN public.poetry_categories c ON c.id=p.category_id
  LEFT JOIN public.explore_submission_details e ON e.submission_id=s.id
  LEFT JOIN public.girls_space_submission_details g ON g.submission_id=s.id
  LEFT JOIN public.herday_community_details_v1 cm ON cm.submission_id=s.id
  LEFT JOIN public.profiles a ON a.id=s.author_id
  WHERE s.section_key IN ('poetry','explore','girls_space','community') AND (p_section_key IS NULL OR s.section_key=p_section_key)
   AND (p_submission_id IS NULL OR s.id=p_submission_id)
   AND (p_category_id IS NULL OR p.category_id=p_category_id)
   AND (p_before_created_at IS NULL OR (s.created_at,s.id)<(p_before_created_at,p_before_id))
   AND ((p_view='published' AND s.status='approved') OR (p_view='mine' AND s.author_id=auth.uid()) OR (p_view='queue' AND s.status='pending' AND public.has_moderator_section_permission(s.section_key,'review')))
   AND (coalesce(btrim(p_query),'')='' OR strpos(lower(s.title||' '||s.body||' '||coalesce(c.name,p.category_name_snapshot,'')||' '||CASE WHEN a.role::text='admin' THEN 'Admin' ELSE coalesce(a.first_name,'')||' '||coalesce(a.last_name,'') END),lower(btrim(p_query)))>0)
  ORDER BY s.created_at DESC,s.id DESC LIMIT p_limit
 ) rows;
 RETURN result;
END; $function$
;
-- Preserve existing author visibility and extend it to approved section authors,
-- visible marketplace authors/comments, and the caller's own conversation peers.
CREATE OR REPLACE FUNCTION public.herday_can_read_author(p_author_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_author_id AND NOT p.is_blocked AND (
 p.id=auth.uid() OR public.is_admin() OR
 EXISTS(SELECT 1 FROM public.content_submissions s WHERE s.author_id=p.id AND (
 (s.status='approved' AND (s.section_key IN ('poetry','community','explore','girls_space') OR
 (s.section_key='buy_sell' AND public.herday_social_visible_v2(s.id)))) OR
 (s.status='pending' AND public.has_moderator_section_permission(s.section_key,'review')))) OR
 EXISTS(SELECT 1 FROM public.herday_poetry_comments c JOIN public.content_submissions s ON s.id=c.submission_id
 WHERE c.author_id=p.id AND s.status='approved' AND (s.section_key IN ('poetry','community','explore','girls_space') OR
 (s.section_key='buy_sell' AND public.herday_social_visible_v2(s.id)))) OR
 EXISTS(SELECT 1 FROM public.herday_conversations_v1 c WHERE p.id IN(c.participant_a,c.participant_b)
 AND public.herday_conversation_allowed_v1(c.id))));
$$;
REVOKE ALL ON FUNCTION public.herday_can_read_author(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Separate additive policy: existing avatar and Beauty photo policies remain untouched.
CREATE FUNCTION public.herday_can_read_profile_avatar_v1(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.avatar_path=p_path
 AND p_path LIKE p.id::text||'/%' AND NOT p.is_blocked
 AND public.herday_can_read_author(p.id));
$$;
REVOKE ALL ON FUNCTION public.herday_can_read_profile_avatar_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.herday_can_read_profile_avatar_v1(text) TO anon,authenticated;
CREATE POLICY "HerDay scoped current profile avatars v1" ON storage.objects
 FOR SELECT TO anon,authenticated
 USING(bucket_id='profile-photos' AND public.herday_can_read_profile_avatar_v1(name));

COMMIT;
SELECT to_regclass('public.herday_product_details_v1') IS NOT NULL AS marketplace_ready,
 to_regprocedure('public.herday_message_send_v1(uuid,uuid,text,jsonb)') IS NOT NULL AS messages_ready,
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='public_about') AS profile_fields_ready;

