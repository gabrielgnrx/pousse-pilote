-- 0043 — Plus de photo de justificatif : des plafonds annuels calés sur le bilan (octobre 2026).
--
-- Sans vérification possible, une photo de billet ou de facture ne prouvait rien et collectait des
-- données personnelles (nom, numéro de réservation) : elle est retirée (décision du 26/10/2026). Les
-- actions qui rapportent le plus sont désormais tenues par des plafonds sur 365 jours, calés sur le
-- bilan (qui ne se refait qu'une fois tous les 30 jours) :
--   - vacances en train : autant que de vols long-courrier déclarés par an, au moins 1 ;
--   - train au lieu de l'avion : 2 trajets par vol court déclaré par an, au moins 4 ;
--   - réparation : 2 par an ;
--   - achats via une appli : 3 par semaine (d'occasion), 3 par semaine (anti-gaspi).
-- La personne confirme sur l'honneur dans l'application, comme pour toute autre action.
-- Les justificatifs déjà déposés restent privés et sont effacés au bout de 30 jours par la purge.

update public.challenge_templates set requires_receipt = false where requires_receipt;

-- Le plafond d'une action sur une période, ou null si elle n'en a pas.
create or replace function public.period_cap(p_template text, p_habits public.habits)
returns table (cap integer, days integer)
language sql immutable
as $$
  select c.cap, c.days from (values
    ('vacances_train', greatest(1, coalesce((p_habits).long_flights_year, 0)), 365),
    ('train',          greatest(4, 2 * coalesce((p_habits).short_flights_year, 0)), 365),
    ('reparation',     2, 365),
    ('appli_occasion', 3, 7),
    ('appli_antigaspi', 3, 7)
  ) as c(template, cap, days)
  where c.template = p_template
$$;

create or replace function public.check_period_cap()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  h public.habits;
  c record;
  used integer;
begin
  select * into h from public.habits where user_id = new.user_id;
  select * into c from public.period_cap(new.template_id, h);
  if not found then
    return new;
  end if;
  select coalesce(sum(v.units), 0) into used
  from public.validations v
  where v.user_id = new.user_id and v.template_id = new.template_id and v.status = 'valid'
    and v.day > new.day - c.days and v.day <= new.day;
  if used + new.units > c.cap then
    raise exception '%', case when c.days = 7 then 'week_cap_reached' else 'year_cap_reached' end;
  end if;
  return new;
end;
$$;
revoke all on function public.check_period_cap() from public;

drop trigger if exists validations_period_cap on public.validations;
create trigger validations_period_cap
  before insert on public.validations
  for each row execute function public.check_period_cap();
