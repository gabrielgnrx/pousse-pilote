-- 0045 — Actions universelles du + (26/10/2026).
--
-- La liste du + passe à 16 actions générales. Deux changements de calcul, demandés et validés :
--   - « Repas végé » (vege, variante repas) : le CO₂ évité est celui du repas habituel déclaré dans le
--     bilan, moyenne du bœuf et des autres viandes pondérée par le nombre de repas de chacun, moins un
--     repas végétarien. Mêmes facteurs Agribalyse qu'avant, aucune nouvelle valeur ;
--   - « Appareil réparé ou reconditionné » : jusqu'à 2 appareils d'un coup (smartphone et ordinateur), le
--     plafond annuel de 2 (migration 0043) restant la limite.
-- Les vêtements d'occasion se déclarent ensemble (« 1 jean et 2 t-shirts ») : une ligne par vêtement,
-- calculée avec son propre facteur, dans les plafonds existants (3 par jour, 3 par semaine).

create or replace function public.unit_kg(p_template text, p_variant text, h public.habits)
returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  car_thermique constant numeric := public.ef('voiture_thermique');
  car_electrique constant numeric := public.ef('voiture_electrique');
  covoiturage constant numeric := public.ef('covoiturage_2');
  transit constant numeric := (public.ef('metro') + public.ef('rer')) / 2;  -- moyenne métro / RER
  avion_court constant numeric := public.ef('avion_court');
  avion_long constant numeric := public.ef('avion_moyen_long');
  tgv constant numeric := public.ef('tgv');
  boeuf constant numeric := public.ef('repas_boeuf');
  vegetarien constant numeric := public.ef('repas_vegetarien');
  vegetalien constant numeric := public.ef('repas_vegetalien');
  autre_viande constant numeric := (public.ef('repas_porc') + public.ef('repas_poulet') + public.ef('repas_poisson')) / 3;
  -- Hypothèses de calcul (voir PLAN.md, § 4).
  long_courrier_km constant numeric := 12000;   -- aller-retour long-courrier
  vacances_train_km constant numeric := 2000;   -- trajet en train qui le remplace
  baisse_par_degre constant numeric := 0.07;
  semaines_de_chauffe constant numeric := 30;
  commute_factor numeric;
  has_commute boolean := h.commute_km > 0 and h.commute_days > 0;
  veg_meals integer := 14 - h.beef_meals_week - h.other_meat_meals_week;
begin
  commute_factor := case h.commute_mode
    when 'voiture_seul' then car_thermique
    when 'voiture_electrique' then car_electrique
    when 'covoiturage' then covoiturage
    when 'transports_en_commun' then transit
    else 0 end;

  case p_template
    when 'velo' then
      if has_commute and commute_factor > 0 then
        return h.commute_km * commute_factor;
      end if;
    when 'transports' then
      if has_commute and commute_factor > transit then
        return h.commute_km * (commute_factor - transit);
      end if;
    when 'covoiturage' then
      if has_commute and h.commute_mode in ('voiture_seul', 'voiture_electrique') then
        return h.commute_km * commute_factor / 2;
      end if;
    when 'train' then
      if h.short_flights_year > 0 and p_variant in ('300', '500', '800') then
        return p_variant::numeric * (avion_court - tgv);
      end if;
    when 'vege' then
      -- Le repas habituel du bilan : bœuf et autres viandes, pondérés par les repas déclarés de chacun.
      if p_variant = 'repas' and h.beef_meals_week + h.other_meat_meals_week > 0 then
        return (h.beef_meals_week * boeuf + h.other_meat_meals_week * autre_viande)
               / (h.beef_meals_week + h.other_meat_meals_week) - vegetarien;
      elsif p_variant = 'boeuf' and h.beef_meals_week > 0 then
        return boeuf - vegetarien;
      elsif p_variant = 'autre' and h.other_meat_meals_week > 0 then
        return autre_viande - vegetarien;
      end if;
    when 'moins_boeuf' then
      if h.beef_meals_week > 0 then
        return boeuf - autre_viande;
      end if;
    when 'occasion' then
      if h.new_clothes_year > 0 then
        return case p_variant
          when 'tshirt' then public.ef('tshirt_neuf')
          when 'chemise' then public.ef('chemise_neuve')
          when 'chaussures' then public.ef('chaussures_cuir_neuves')
          when 'jean' then public.ef('jean_neuf')
          when 'pull' then public.ef('pull_laine_neuf')
          when 'manteau' then public.ef('manteau_neuf')
          else 0 end;
      end if;
    when 'chauffage' then
      if h.heating_kg_year > 0 then
        return h.heating_kg_year * baisse_par_degre / semaines_de_chauffe;
      end if;
    when 'vegetalien' then
      if veg_meals > 0 then
        return vegetarien - vegetalien;
      end if;
    when 'vacances_train' then
      if h.long_flights_year > 0 then
        return long_courrier_km * avion_long - vacances_train_km * tgv;
      end if;
    when 'reparation' then
      if p_variant = 'smartphone' and h.buys_new_phone then
        return public.ef('smartphone_neuf');
      elsif p_variant = 'ordinateur' and h.new_devices_year > 0 then
        return public.ef('ordinateur_portable_neuf');
      end if;
    when 'teletravail' then
      if has_commute and commute_factor > 0 then
        return 2 * h.commute_km * commute_factor;
      end if;
    when 'eau_robinet' then
      if coalesce(h.bottled_water_l_day, 0) > 0 then
        return h.bottled_water_l_day * (public.ef('eau_bouteille') - public.ef('eau_robinet'));
      end if;
    when 'appli_occasion' then
      return public.unit_kg(case when p_variant in ('smartphone', 'ordinateur') then 'reparation' else 'occasion' end,
                            p_variant, h);
    else
      null;
  end case;
  return 0;
end;
$$;

update public.challenge_templates set cap_units = 2 where id = 'reparation';
